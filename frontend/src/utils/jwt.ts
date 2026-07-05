import type { AuthUser, Perfil } from '@/types';

interface JwtClaims {
  sub: string;
  login: string;
  perfil: Perfil;
  hospitalId?: string | null;
  superAdmin?: boolean;
  exp?: number;
}

/** Decodifica o payload do JWT (sem validar assinatura — só para UI/RBAC). */
export function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as JwtClaims;
    if (!json.sub || !json.perfil) return null;
    return {
      id: json.sub,
      login: json.login,
      perfil: json.perfil,
      hospitalId: json.hospitalId ?? null,
      superAdmin: json.superAdmin === true,
      exp: json.exp,
    };
  } catch {
    return null;
  }
}

export function isExpired(user: AuthUser | null): boolean {
  if (!user?.exp) return false;
  return Date.now() >= user.exp * 1000;
}
