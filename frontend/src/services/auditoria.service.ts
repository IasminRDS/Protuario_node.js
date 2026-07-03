import { api } from './api';
import type { ApiEnvelope, PaginatedResult, Auditoria } from '@/types';

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
};
