/**
 * Payload do usuário autenticado, anexado a request.user pelo JwtStrategy.
 */
export interface AuthenticatedUser {
  id: string; // BigInt serializado como string
  login: string;
  perfil: string; // Perfil.nome
  hospitalId: string | null; // tenant (multi-hospital)
}

export interface JwtPayload {
  sub: string; // Usuario.id (string)
  login: string;
  perfil: string;
  hospitalId: string | null;
}
