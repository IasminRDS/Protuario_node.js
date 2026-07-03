'use client';

import { useAuthStore } from '@/store/auth.store';
import type { Perfil } from '@/types';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);

  return {
    user,
    hydrated,
    logout,
    isAuthenticated: !!user,
    hasRole: (...roles: Perfil[]) => !!user && roles.includes(user.perfil),
  };
}
