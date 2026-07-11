import { api } from './api';
import type { ApiEnvelope, AuthTokens } from '@/types';

/** Login pode exigir uma segunda etapa (TOTP) quando o usuário tem MFA ativo. */
export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export interface MfaStatus {
  enabled: boolean;
  verified: boolean;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
}

export function isMfaChallenge(r: AuthTokens | MfaChallenge): r is MfaChallenge {
  return (r as MfaChallenge).mfaRequired === true;
}

export const authService = {
  async login(login: string, senha: string): Promise<AuthTokens | MfaChallenge> {
    const { data } = await api.post<ApiEnvelope<AuthTokens | MfaChallenge>>(
      '/auth/login',
      { login, senha },
    );
    return data.data;
  },

  /** Segunda etapa: código do autenticador → tokens definitivos. */
  async mfaVerify(mfaToken: string, code: string): Promise<AuthTokens> {
    const { data } = await api.post<ApiEnvelope<AuthTokens>>('/auth/mfa/verify', {
      mfaToken,
      code,
    });
    return data.data;
  },

  async mfaStatus(): Promise<MfaStatus> {
    const { data } = await api.get<ApiEnvelope<MfaStatus>>('/auth/mfa/status');
    return data.data;
  },

  async mfaSetup(): Promise<MfaSetup> {
    const { data } = await api.post<ApiEnvelope<MfaSetup>>('/auth/mfa/setup');
    return data.data;
  },

  async mfaEnable(code: string): Promise<void> {
    await api.post('/auth/mfa/enable', { code });
  },

  async mfaDisable(code: string): Promise<void> {
    await api.post('/auth/mfa/disable', { code });
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
