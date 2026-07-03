'use client';

import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import { tokenStorage } from '@/utils/token-storage';
import { decodeJwt, isExpired } from '@/utils/jwt';
import type { AuthTokens, AuthUser } from '@/types';

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (tokens: AuthTokens) => void;
  logout: () => Promise<void>;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,

  // Reconstrói a sessão a partir do token persistido (chamado no client).
  hydrate: () => {
    const token = tokenStorage.getAccess();
    const user = token ? decodeJwt(token) : null;
    set({ user: user && !isExpired(user) ? user : null, hydrated: true });
  },

  login: (tokens) => {
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    set({ user: decodeJwt(tokens.accessToken), hydrated: true });
  },

  logout: async () => {
    await authService.logout();
    tokenStorage.clear();
    set({ user: null });
  },

  isAuthenticated: () => {
    const u = get().user;
    return !!u && !isExpired(u);
  },
}));
