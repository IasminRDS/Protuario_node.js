import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tokenStorage } from '@/utils/token-storage';
import type { ApiEnvelope, AuthTokens } from '@/types';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// --- Request: injeta o Bearer token ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// --- Response: refresh transparente em 401 (single-flight) e redirect ---
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    // Chamada "crua" (sem interceptor) para não recursar.
    const { data } = await axios.post<ApiEnvelope<AuthTokens>>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
    );
    tokenStorage.set(data.data.accessToken, data.data.refreshToken);
    return data.data.accessToken;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;

    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      refreshing = refreshing ?? doRefresh();
      const newToken = await refreshing;
      refreshing = null;

      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return api(original);
      }
      // Sessão irrecuperável: limpa e volta ao login.
      tokenStorage.clear();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

/** Extrai mensagem de erro padronizada do backend. */
export function apiErrorMessage(err: unknown, fallback = 'Erro inesperado.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return data?.error?.message ?? data?.message ?? err.message ?? fallback;
  }
  return fallback;
}
