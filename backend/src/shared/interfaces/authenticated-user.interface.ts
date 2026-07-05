/**
 * Payload do usuário autenticado, anexado a request.user pelo JwtStrategy.
 */
export interface AuthenticatedUser {
  id: string; // BigInt serializado como string
  login: string;
  perfil: string; // Perfil.nome
  hospitalId: string | null; // tenant (multi-hospital)
  superAdmin: boolean; // acesso cross-tenant (SUPER_ADMIN)
}

export interface JwtPayload {
  sub: string; // Usuario.id (string)
  login: string;
  perfil: string;
  hospitalId: string | null;
  superAdmin?: boolean; // informativo; o bypass real é revalidado pelo perfil
}
