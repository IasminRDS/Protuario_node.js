import { api } from './api';
import type { ApiEnvelope, AuthTokens } from '@/types';

export const authService = {
  async login(login: string, senha: string): Promise<AuthTokens> {
    const { data } = await api.post<ApiEnvelope<AuthTokens>>('/auth/login', {
      login,
      senha,
    });
    return data.data;
  },

  async logout(): Promise<void> {
    // Best-effort: invalida o refresh no servidor.
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignora — o logout local sempre acontece */
    }
  },

  async changePassword(senhaAtual: string, novaSenha: string): Promise<void> {
    await api.post('/auth/change-password', { senhaAtual, novaSenha });
  },
};
