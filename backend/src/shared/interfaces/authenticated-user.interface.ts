/**
 * Payload do usuário autenticado, anexado a request.user pelo JwtStrategy.
 */
export interface AuthenticatedUser {
  id: string; // BigInt serializado como string
  login: string;
  perfil: string; // Perfil.nome
  hospitalId: string | null; // tenant (multi-hospital)
  superAdmin: boolean; // acesso cross-tenant (SUPER_ADMIN)
  mfaEnabled?: boolean; // usuário tem TOTP ativo (fonte: banco)
  mfaVerified?: boolean; // sessão atual passou pelo desafio TOTP (claim do token)
  govbrSelo?: string | null; // selo da última autenticação gov.br (bronze|prata|ouro)
}

export interface JwtPayload {
  sub: string; // Usuario.id (string)
  login: string;
  perfil: string;
  hospitalId: string | null;
  superAdmin?: boolean; // informativo; o bypass real é revalidado pelo perfil
  mfa?: boolean; // sessão emitida após desafio TOTP
  selo?: string; // selo gov.br quando a sessão nasceu de login federado
}

/** Token intermediário do desafio MFA (curta duração, escopo restrito). */
export interface MfaChallengePayload {
  sub: string;
  scope: 'mfa';
}
