import { api } from './api';
import type { ApiEnvelope, PaginatedResult, Auditoria } from '@/types';

export interface VerificacaoCadeia {
  integra: boolean;
  verificados: number;
  naoSelados: number;
  quebradoNoId: string | null;
}

export const auditoriaService = {
  async list(params: {
    page?: number;
    pageSize?: number;
    modulo?: string;
    usuarioId?: string;
  }): Promise<PaginatedResult<Auditoria>> {
    const { data } = await api.get<ApiEnvelope<PaginatedResult<Auditoria>>>(
      '/auditoria',
      { params },
    );
    return data.data;
  },

  /** Verifica a integridade da cadeia de hash (ADR-06). */
  async verify(): Promise<VerificacaoCadeia> {
    const { data } = await api.get<ApiEnvelope<VerificacaoCadeia>>('/auditoria/verify');
    return data.data;
  },

  /** Sela (encadeia) os eventos ainda sem hash. */
  async selar(): Promise<{ selados: number; total: number }> {
    const { data } = await api.post<ApiEnvelope<{ selados: number; total: number }>>(
      '/auditoria/selar',
      {},
    );
    return data.data;
  },
};
