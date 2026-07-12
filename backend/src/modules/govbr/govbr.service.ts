import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthService, AuthTokens } from '../auth/auth.service';

/** Selo gov.br: nível de confiabilidade da conta (bronze < prata < ouro). */
export type GovbrSelo = 'bronze' | 'prata' | 'ouro';

interface StatePayload {
  nonce: string;
  scope: 'govbr-state';
}
interface CodePayload {
  usuarioId: string;
  selo: GovbrSelo;
  scope: 'govbr-code';
}

/**
 * Login gov.br (OIDC Authorization Code). Duas operações:
 *  - modo SIMULADOR (dev/homolog): um IdP embutido renderiza a tela de contas
 *    e devolve um `code` assinado por nós — o fluxo completo roda offline;
 *  - modo REAL: `authorizeUrl` aponta para sso.acesso.gov.br e o `code` é
 *    trocado no token endpoint do gov.br (a implementar quando houver
 *    credenciamento — o ponto de extensão está em `resolveCode`).
 *
 * Os tokens da nossa aplicação NUNCA trafegam na URL: o callback guarda-os sob
 * um código de uso único (TTL curto) que o frontend troca via POST.
 */
@Injectable()
export class GovbrService {
  private readonly logger = new Logger(GovbrService.name);
  // Códigos de sessão de uso único: oneTime → { tokens, expira }.
  private readonly sessoes = new Map<string, { tokens: AuthTokens; expira: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private secret(): string {
    return this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  private simulador(): boolean {
    return this.config.get<boolean>('GOVBR_SIMULATOR', true);
  }

  /** URL de autorização (authorize). No simulador, aponta para o IdP embutido. */
  async authorizeUrl(): Promise<string> {
    const state = await this.jwt.signAsync(
      { nonce: randomUUID(), scope: 'govbr-state' } satisfies StatePayload,
      { secret: this.secret(), expiresIn: '10m' },
    );

    if (this.simulador()) {
      return `/api/v1/auth/govbr/simulador?state=${encodeURIComponent(state)}`;
    }

    const base = this.config.getOrThrow<string>('GOVBR_AUTHORIZE_URL');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.getOrThrow<string>('GOVBR_CLIENT_ID'),
      scope: 'openid+email+profile+govbr_confiabilidades',
      redirect_uri: this.redirectUri(),
      state,
    });
    return `${base}?${params.toString()}`;
  }

  private redirectUri(): string {
    // Onde o gov.br devolve o code (nosso callback).
    return 'http://localhost:3000/api/v1/auth/govbr/callback';
  }

  private async validarState(state: string): Promise<void> {
    try {
      const p = await this.jwt.verifyAsync<StatePayload>(state, {
        secret: this.secret(),
      });
      if (p.scope !== 'govbr-state') throw new Error('escopo');
    } catch {
      throw new BadRequestException('Parâmetro state inválido ou expirado.');
    }
  }

  /** Lista de contas para a tela do simulador (usuários ativos reais). */
  async contasSimuladas() {
    const users = await this.prisma.usuario.findMany({
      where: { ativo: true, deletedAt: null },
      select: { id: true, nome: true, login: true, perfil: { select: { nome: true } } },
      orderBy: { id: 'asc' },
      take: 30,
    });
    // Selo determinístico só para dar textura à simulação (perfil clínico = ouro).
    return users.map((u) => ({
      id: u.id.toString(),
      nome: u.nome,
      login: u.login,
      perfil: u.perfil.nome,
      selo: (['Medico', 'Enfermeiro'].includes(u.perfil.nome)
        ? 'ouro'
        : u.perfil.nome === 'SuperAdmin'
          ? 'prata'
          : 'bronze') as GovbrSelo,
    }));
  }

  /** Gera o `code` assinado do simulador para a conta escolhida. */
  async gerarCodeSimulado(usuarioId: string, selo: GovbrSelo, state: string): Promise<string> {
    await this.validarState(state);
    return this.jwt.signAsync(
      { usuarioId, selo, scope: 'govbr-code' } satisfies CodePayload,
      { secret: this.secret(), expiresIn: '5m' },
    );
  }

  /**
   * Resolve o `code` do callback em { usuarioId, selo }. No simulador o code é
   * um JWT nosso; no modo real, aqui entra a troca no token endpoint do gov.br
   * (POST /token) + leitura do userinfo (sub=CPF → Usuario.cpf).
   */
  private async resolveCode(code: string): Promise<{ usuarioId: string; selo: GovbrSelo }> {
    if (this.simulador()) {
      try {
        const p = await this.jwt.verifyAsync<CodePayload>(code, { secret: this.secret() });
        if (p.scope !== 'govbr-code') throw new Error('escopo');
        return { usuarioId: p.usuarioId, selo: p.selo };
      } catch {
        throw new UnauthorizedException('Código de autorização inválido ou expirado.');
      }
    }

    // MODO REAL — OIDC Authorization Code: troca o `code` no token endpoint do
    // gov.br e lê o userinfo. `sub` = CPF → casa com Usuario.cpf (sem
    // auto-provisionamento: profissional precisa existir e estar ativo).
    const tokenUrl = this.config.get<string>('GOVBR_TOKEN_URL', '');
    const userinfoUrl = this.config.get<string>('GOVBR_USERINFO_URL', '');
    const clientId = this.config.getOrThrow<string>('GOVBR_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOVBR_CLIENT_SECRET');
    if (!tokenUrl || !userinfoUrl) {
      throw new BadRequestException('Endpoints gov.br não configurados.');
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(),
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException('Falha na troca do código no gov.br.');
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new UnauthorizedException('Token gov.br ausente.');
    }

    const uiRes = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!uiRes.ok) throw new UnauthorizedException('Falha ao ler userinfo gov.br.');
    const ui = (await uiRes.json()) as {
      sub?: string;
      amr?: string[];
      'urn:govbr:confiabilidades'?: string[];
    };
    const cpf = (ui.sub ?? '').replace(/\D/g, '');
    if (!cpf) throw new UnauthorizedException('CPF ausente no userinfo gov.br.');

    const usuario = await this.prisma.usuario.findFirst({
      where: { cpf, ativo: true, deletedAt: null },
      select: { id: true },
    });
    if (!usuario) {
      throw new UnauthorizedException(
        'CPF autenticado no gov.br não corresponde a um profissional ativo.',
      );
    }

    // Selo a partir da confiabilidade gov.br (biometria/certificado = ouro).
    const conf = [...(ui.amr ?? []), ...(ui['urn:govbr:confiabilidades'] ?? [])]
      .join(' ')
      .toLowerCase();
    const selo: GovbrSelo = /biometria|certificado|cert/.test(conf)
      ? 'ouro'
      : /cadastro|servidor|banco/.test(conf)
        ? 'prata'
        : 'bronze';

    return { usuarioId: usuario.id.toString(), selo };
  }

  /** Callback: resolve o code, emite nossos tokens e devolve um código de uso único. */
  async concluirCallback(code: string, state: string, ip?: string): Promise<string> {
    await this.validarState(state);
    const { usuarioId, selo } = await this.resolveCode(code);
    const tokens = await this.auth.loginFederado(usuarioId, selo, ip);

    const oneTime = randomUUID();
    this.sessoes.set(oneTime, { tokens, expira: Date.now() + 120_000 });
    return oneTime;
  }

  /** Troca (uma única vez) o código de sessão pelos tokens da aplicação. */
  trocarSessao(oneTime: string): AuthTokens {
    const s = this.sessoes.get(oneTime);
    this.sessoes.delete(oneTime); // consumo único
    if (!s || s.expira < Date.now()) {
      throw new UnauthorizedException('Sessão gov.br inválida ou expirada.');
    }
    return s.tokens;
  }
}
