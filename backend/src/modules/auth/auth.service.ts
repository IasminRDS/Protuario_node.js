import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PasswordService } from '../../infra/auth/password.service';
import { TotpService } from '../../infra/auth/totp.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  JwtPayload,
  MfaChallengePayload,
} from '../../shared/interfaces/authenticated-user.interface';
import { isSuperAdmin } from '../../shared/rbac/permissions';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Resposta do login quando o usuário tem MFA ativo (step-up). */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string; // token curto (5min) aceito apenas em /auth/mfa/verify
}

/**
 * Autenticação (cap. 112/147/148):
 *  - login: valida credenciais, bloqueia após N tentativas (RN-003), emite
 *    access + refresh e audita a operação.
 *  - refresh: rotaciona tokens validando o hash armazenado.
 *  - logout: invalida o refresh token.
 *  - changePassword: exige senha atual e aplica política de senha forte.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(
    login: string,
    senha: string,
    ip?: string,
  ): Promise<AuthTokens | MfaChallenge> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { login, deletedAt: null },
      include: { perfil: true },
    });

    const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5);

    // Falha genérica para não revelar existência do login.
    const falha = async (motivo: string) => {
      await this.auditoria.registrar({
        usuarioId: usuario?.id ?? null,
        modulo: 'AUTH',
        operacao: 'LOGIN_FALHA',
        objeto: login,
        resultado: motivo,
        ip,
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    };

    if (!usuario) {
      return falha('USUARIO_INEXISTENTE');
    }
    if (!usuario.ativo) {
      return falha('USUARIO_INATIVO');
    }
    if (usuario.loginAttempts >= maxAttempts) {
      return falha('BLOQUEADO_TENTATIVAS');
    }

    const ok = await this.passwords.verify(usuario.senha, senha);
    if (!ok) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { loginAttempts: { increment: 1 } },
      });
      return falha('SENHA_INVALIDA');
    }

    // Step-up MFA: senha correta + TOTP ativo → desafio antes dos tokens.
    if (usuario.mfaEnabled && usuario.mfaSecret) {
      const mfaToken = await this.jwt.signAsync(
        { sub: usuario.id.toString(), scope: 'mfa' } satisfies MfaChallengePayload,
        {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '5m',
        },
      );
      await this.auditoria.registrar({
        usuarioId: usuario.id,
        modulo: 'AUTH',
        operacao: 'LOGIN_MFA_DESAFIO',
        objeto: usuario.login,
        resultado: 'PENDENTE',
        ip,
      });
      return { mfaRequired: true, mfaToken };
    }

    const tokens = await this.issueTokens({
      sub: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
      superAdmin: isSuperAdmin(usuario.perfil.nome),
      mfa: false,
    });

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        loginAttempts: 0,
        refreshTokenHash: await this.passwords.hash(tokens.refreshToken),
      },
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      modulo: 'AUTH',
      operacao: 'LOGIN',
      objeto: usuario.login,
      resultado: 'SUCESSO',
      ip,
    });

    return tokens;
  }

  /** Segunda etapa do login: valida o código TOTP e emite os tokens (mfa=true). */
  async mfaVerify(
    mfaToken: string,
    code: string,
    ip?: string,
  ): Promise<AuthTokens> {
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwt.verifyAsync<MfaChallengePayload>(mfaToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Desafio MFA inválido ou expirado.');
    }
    if (payload.scope !== 'mfa') {
      throw new UnauthorizedException('Desafio MFA inválido.');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: BigInt(payload.sub), ativo: true, deletedAt: null },
      include: { perfil: true },
    });
    if (!usuario?.mfaEnabled || !usuario.mfaSecret) {
      throw new UnauthorizedException('MFA não está ativo para este usuário.');
    }

    const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5);
    if (usuario.loginAttempts >= maxAttempts) {
      throw new UnauthorizedException('Conta bloqueada por tentativas.');
    }

    if (!this.totp.verify(usuario.mfaSecret, code)) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { loginAttempts: { increment: 1 } },
      });
      await this.auditoria.registrar({
        usuarioId: usuario.id,
        modulo: 'AUTH',
        operacao: 'LOGIN_MFA_FALHA',
        objeto: usuario.login,
        resultado: 'CODIGO_INVALIDO',
        ip,
      });
      throw new UnauthorizedException('Código MFA inválido.');
    }

    const tokens = await this.issueTokens({
      sub: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
      superAdmin: isSuperAdmin(usuario.perfil.nome),
      mfa: true,
    });

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        loginAttempts: 0,
        refreshTokenHash: await this.passwords.hash(tokens.refreshToken),
      },
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      modulo: 'AUTH',
      operacao: 'LOGIN',
      objeto: usuario.login,
      resultado: 'SUCESSO_MFA',
      ip,
    });

    return tokens;
  }

  /** Gera segredo TOTP provisório (ativação só ocorre em mfaEnable). */
  async mfaSetup(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: BigInt(usuarioId) },
    });
    if (usuario.mfaEnabled) {
      throw new ConflictException('MFA já está ativo. Desative antes de reconfigurar.');
    }

    const secret = this.totp.generateSecret();
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { mfaSecret: secret },
    });

    return {
      secret,
      otpauthUrl: this.totp.otpauthUrl(usuario.login, secret),
    };
  }

  /** Confirma o código do autenticador e ATIVA o MFA. */
  async mfaEnable(usuarioId: string, code: string, ip?: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: BigInt(usuarioId) },
    });
    if (usuario.mfaEnabled) {
      throw new ConflictException('MFA já está ativo.');
    }
    if (!usuario.mfaSecret) {
      throw new BadRequestException('Execute o setup do MFA antes de ativar.');
    }
    if (!this.totp.verify(usuario.mfaSecret, code)) {
      throw new UnauthorizedException('Código MFA inválido.');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { mfaEnabled: true },
    });
    await this.auditoria.registrar({
      usuarioId,
      modulo: 'AUTH',
      operacao: 'MFA_ATIVADO',
      objeto: usuario.login,
      resultado: 'SUCESSO',
      ip,
    });
  }

  /** Desativa o MFA mediante código válido (auditado). */
  async mfaDisable(usuarioId: string, code: string, ip?: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: BigInt(usuarioId) },
    });
    if (!usuario.mfaEnabled || !usuario.mfaSecret) {
      throw new BadRequestException('MFA não está ativo.');
    }
    if (!this.totp.verify(usuario.mfaSecret, code)) {
      throw new UnauthorizedException('Código MFA inválido.');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { mfaEnabled: false, mfaSecret: null, refreshTokenHash: null },
    });
    await this.auditoria.registrar({
      usuarioId,
      modulo: 'AUTH',
      operacao: 'MFA_DESATIVADO',
      objeto: usuario.login,
      resultado: 'SUCESSO',
      ip,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: BigInt(payload.sub), ativo: true, deletedAt: null },
      include: { perfil: true },
    });

    if (!usuario || !usuario.refreshTokenHash) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const valido = await this.passwords.verify(
      usuario.refreshTokenHash,
      refreshToken,
    );
    if (!valido) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const tokens = await this.issueTokens({
      sub: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
      superAdmin: isSuperAdmin(usuario.perfil.nome),
      mfa: payload.mfa === true, // preserva a verificação MFA da sessão
    });

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { refreshTokenHash: await this.passwords.hash(tokens.refreshToken) },
    });

    return tokens;
  }

  /**
   * Emite tokens para um usuário JÁ autenticado por um provedor federado
   * (gov.br OIDC). O login local (senha/MFA) NÃO se aplica — a garantia de
   * identidade vem do IdP. Persiste o selo gov.br e o refresh hash, e audita.
   */
  async loginFederado(
    usuarioId: string,
    selo: string,
    ip?: string,
  ): Promise<AuthTokens> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: BigInt(usuarioId), ativo: true, deletedAt: null },
      include: { perfil: true },
    });
    if (!usuario) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
    }

    const tokens = await this.issueTokens({
      sub: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
      superAdmin: isSuperAdmin(usuario.perfil.nome),
      mfa: selo === 'ouro', // selo ouro (certificado/biometria) equivale a 2FA forte
      selo,
    });

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        loginAttempts: 0,
        govbrSelo: selo,
        refreshTokenHash: await this.passwords.hash(tokens.refreshToken),
      },
    });

    await this.auditoria.registrar({
      usuarioId: usuario.id,
      modulo: 'AUTH',
      operacao: 'LOGIN',
      objeto: usuario.login,
      resultado: `SUCESSO_GOVBR_${selo.toUpperCase()}`,
      ip,
    });

    return tokens;
  }

  async logout(usuarioId: string, ip?: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: BigInt(usuarioId) },
      data: { refreshTokenHash: null },
    });
    await this.auditoria.registrar({
      usuarioId,
      modulo: 'AUTH',
      operacao: 'LOGOUT',
      resultado: 'SUCESSO',
      ip,
    });
  }

  async changePassword(
    usuarioId: string,
    senhaAtual: string,
    novaSenha: string,
    ip?: string,
  ): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: BigInt(usuarioId) },
    });

    const ok = await this.passwords.verify(usuario.senha, senhaAtual);
    if (!ok) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: await this.passwords.hash(novaSenha),
        refreshTokenHash: null, // encerra sessões existentes
      },
    });

    await this.auditoria.registrar({
      usuarioId,
      modulo: 'AUTH',
      operacao: 'ALTERACAO_SENHA',
      resultado: 'SUCESSO',
      ip,
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
