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

export interface CboItem {
  codigo: string;
  descricao: string;
}
export interface SigtapItem {
  codigo: string;
  descricao: string;
}
export interface CnesItem {
  cnes: string;
  nome: string;
  municipio: string;
  uf: string;
}

export const terminologiaService = {
  async cbo(q: string): Promise<CboItem[]> {
    if (!q.trim()) return [];
    const { data } = await api.get<ApiEnvelope<CboItem[]>>('/terminologia/cbo', {
      params: { q },
    });
    return data.data;
  },

  async sigtap(q: string): Promise<SigtapItem[]> {
    if (!q.trim()) return [];
    const { data } = await api.get<ApiEnvelope<SigtapItem[]>>('/terminologia/sigtap', {
      params: { q },
    });
    return data.data;
  },

  async cnes(q: string): Promise<CnesItem[]> {
    if (!q.trim()) return [];
    const { data } = await api.get<ApiEnvelope<CnesItem[]>>('/terminologia/cnes', {
      params: { q },
    });
    return data.data;
  },

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
