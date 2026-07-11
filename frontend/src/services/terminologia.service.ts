import { api } from './api';
import type { ApiEnvelope } from '@/types';

export interface Cid10 {
  codigo: string;
  descricao: string;
}

export interface MedicamentoCatalogo {
  nome: string;
  apresentacao: string;
  via: string;
}

export const terminologiaService = {
  async cid10(q: string): Promise<Cid10[]> {
    if (!q.trim()) return [];
    const { data } = await api.get<ApiEnvelope<Cid10[]>>('/terminologia/cid10', {
      params: { q },
    });
    return data.data;
  },

  async medicamentos(q: string): Promise<MedicamentoCatalogo[]> {
    if (!q.trim()) return [];
    const { data } = await api.get<ApiEnvelope<MedicamentoCatalogo[]>>(
      '/terminologia/medicamentos',
      { params: { q } },
    );
    return data.data;
  },
};
