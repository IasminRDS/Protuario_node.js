'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ApiEnvelope, PaginatedResult } from '@/types';
import { clinicalKeys } from './keys';
import type {
  AltaInput,
  EvolucaoInput,
  Internacao,
  InternarInput,
  Leito,
  Setor,
} from './types';

export const internacaoService = {
  async setores(): Promise<Setor[]> {
    const { data } = await api.get<ApiEnvelope<Setor[]>>(
      '/internacao/setores',
    );
    return data.data;
  },
  async leitos(status?: string): Promise<Leito[]> {
    const { data } = await api.get<ApiEnvelope<Leito[]>>('/internacao/leitos', {
      params: status ? { status } : undefined,
    });
    return data.data;
  },
  async ativas(): Promise<PaginatedResult<Internacao>> {
    const { data } = await api.get<ApiEnvelope<PaginatedResult<Internacao>>>(
      '/internacao',
      { params: { page: 1, pageSize: 50 } },
    );
    return data.data;
  },
  async detalhe(id: string): Promise<Internacao> {
    const { data } = await api.get<ApiEnvelope<Internacao>>(
      `/internacao/${id}`,
    );
    return data.data;
  },
  async internar(input: InternarInput): Promise<Internacao> {
    const { data } = await api.post<ApiEnvelope<Internacao>>(
      '/internacao',
      input,
    );
    return data.data;
  },
  async evoluir(id: string, input: EvolucaoInput): Promise<unknown> {
    const { data } = await api.post<ApiEnvelope<unknown>>(
      `/internacao/${id}/evolucao`,
      input,
    );
    return data.data;
  },
  async alta(id: string, input: AltaInput): Promise<Internacao> {
    const { data } = await api.post<ApiEnvelope<Internacao>>(
      `/internacao/${id}/alta`,
      input,
    );
    return data.data;
  },
};

export function useLeitos(status?: string) {
  return useQuery({
    queryKey: clinicalKeys.leitos(status),
    queryFn: () => internacaoService.leitos(status),
  });
}

export function useSetores() {
  return useQuery({
    queryKey: clinicalKeys.setores,
    queryFn: internacaoService.setores,
  });
}

export function useInternacoesAtivas() {
  return useQuery({
    queryKey: clinicalKeys.internacoes,
    queryFn: internacaoService.ativas,
  });
}

export function useInternacaoDetalhe(id: string | null) {
  return useQuery({
    queryKey: clinicalKeys.internacao(id ?? ''),
    queryFn: () => internacaoService.detalhe(id as string),
    enabled: !!id,
  });
}

/** Invalida leitos + internações (mapa de ocupação muda em qualquer mutação). */
function invalidarOcupacao(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['clinical', 'leitos'] });
  qc.invalidateQueries({ queryKey: clinicalKeys.internacoes });
  qc.invalidateQueries({ queryKey: clinicalKeys.setores });
}

export function useInternar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InternarInput) => internacaoService.internar(input),
    onSuccess: () => invalidarOcupacao(qc),
  });
}

export function useEvoluir(internacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EvolucaoInput) =>
      internacaoService.evoluir(internacaoId, input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: clinicalKeys.internacao(internacaoId),
      }),
  });
}

export function useDarAlta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AltaInput }) =>
      internacaoService.alta(id, input),
    onSuccess: () => invalidarOcupacao(qc),
  });
}
