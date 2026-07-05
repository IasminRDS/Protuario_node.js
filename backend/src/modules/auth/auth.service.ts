import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PasswordService } from '../../infra/auth/password.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtPayload } from '../../shared/interfaces/authenticated-user.interface';
import { isSuperAdmin } from '../../shared/rbac/permissions';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(
    login: string,
    senha: string,
    ip?: string,
  ): Promise<AuthTokens> {
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

    const tokens = await this.issueTokens({
      sub: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
      superAdmin: isSuperAdmin(usuario.perfil.nome),
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
    });

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { refreshTokenHash: await this.passwords.hash(tokens.refreshToken) },
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
