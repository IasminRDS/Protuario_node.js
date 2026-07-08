'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '@/services/api';
import type { ApiEnvelope } from '@/types';
import type {
  AtendimentoPorDia,
  ExameRealizado,
  OcupacaoLeitos,
  TempoMedio,
} from '../types';

// Backend já resolve tenant + agregação + performance (materialized views) →
// frontend é 100% read-only com cache agressivo (5 min).
const STALE = 5 * 60_000;

export const reportsKeys = {
  root: ['reports'] as const,
  atendimentos: ['reports', 'atendimentos-por-dia'] as const,
  ocupacao: ['reports', 'ocupacao-leitos'] as const,
  tempo: ['reports', 'tempo-medio'] as const,
  exames: ['reports', 'exames'] as const,
};

async function get<T>(path: string): Promise<T> {
  const { data } = await api.get<ApiEnvelope<T>>(path);
  return data.data;
}

export function useAtendimentosPorDia() {
  return useQuery({
    queryKey: reportsKeys.atendimentos,
    queryFn: () => get<AtendimentoPorDia[]>('/reports/atendimentos-por-dia'),
    staleTime: STALE,
  });
}

export function useOcupacaoLeitos() {
  return useQuery({
    queryKey: reportsKeys.ocupacao,
    queryFn: () => get<OcupacaoLeitos>('/reports/ocupacao-leitos'),
    staleTime: STALE,
  });
}

export function useTempoMedio() {
  return useQuery({
    queryKey: reportsKeys.tempo,
    queryFn: () => get<TempoMedio>('/reports/tempo-medio'),
    staleTime: STALE,
  });
}

export function useExames() {
  return useQuery({
    queryKey: reportsKeys.exames,
    queryFn: () => get<ExameRealizado[]>('/reports/exames'),
    staleTime: STALE,
  });
}

/** Refetch manual: invalida o cache de relatórios (NÃO força refresh no backend). */
export function useRefreshReports() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: reportsKeys.root });
}

export function reportsErrorMessage(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 403) return 'Acesso negado: você não tem permissão para relatórios.';
  if (status === 401) return 'Sessão expirada. Faça login novamente.';
  return 'Não foi possível carregar os relatórios. Tente novamente.';
}
