import { Usuario } from '@prisma/client';

/**
 * View pública de usuário — nunca expõe senha nem refreshTokenHash (cap. 156).
 * Serializa BigInt como string.
 */
export interface UsuarioView {
  id: string;
  nome: string;
  login: string;
  email: string | null;
  perfilId: string;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toUsuarioView(u: Usuario): UsuarioView {
  return {
    id: u.id.toString(),
    nome: u.nome,
    login: u.login,
    email: u.email,
    perfilId: u.perfilId.toString(),
    ativo: u.ativo,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
