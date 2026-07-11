import { api } from './api';
import type { ApiEnvelope } from '@/types';

export interface ResumoEpidemiologico {
  notificacoes: { pendentes: number; imediatas: number };
  leitos: { total: number; ocupados: number; taxaOcupacao: number };
  regulacao: { filaAberta: number };
  triagens24h: number;
  internacoesAtivas: number;
}

export interface AgravoCount {
  agravo: string;
  total: number;
}

export interface MunicipioCount {
  municipio: string;
  uf: string;
  total: number;
}

export interface OcupacaoSetor {
  setor: string;
  nome: string;
  tipo: string;
  total: number;
  ocupados: number;
  livres: number;
  reservados: number;
  higienizacao: number;
  interditados: number;
  taxaOcupacao: number;
}

export interface FilaRegulacaoAgg {
  porStatus: { status: string; total: number }[];
  porPrioridade: { prioridade: string; total: number }[];
}

export interface ManchesterCount {
  classificacao: string;
  total: number;
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get<ApiEnvelope<T>>(path, { params });
  return data.data;
}

export const epidemiologiaService = {
  resumo: () => get<ResumoEpidemiologico>('/epidemiologia/resumo'),
  porAgravo: (dias = 30) =>
    get<AgravoCount[]>('/epidemiologia/notificacoes-por-agravo', { dias }),
  porMunicipio: (dias = 30) =>
    get<MunicipioCount[]>('/epidemiologia/notificacoes-por-municipio', { dias }),
  ocupacaoLeitos: () => get<OcupacaoSetor[]>('/epidemiologia/ocupacao-leitos'),
  filaRegulacao: () => get<FilaRegulacaoAgg>('/epidemiologia/fila-regulacao'),
  manchester: (dias = 7) =>
    get<ManchesterCount[]>('/epidemiologia/triagem-manchester', { dias }),
};
