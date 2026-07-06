'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ApiEnvelope } from '@/types';
import { clinicalKeys } from './keys';
import type {
  AtendimentoPS,
  CreateChegadaInput,
  FinalizarPsInput,
} from './types';

// --- Service (chamadas cruas à API real /api/v1/pronto-socorro) ------------
export const emergenciaService = {
  async fila(): Promise<AtendimentoPS[]> {
    const { data } = await api.get<ApiEnvelope<AtendimentoPS[]>>(
      '/pronto-socorro/fila',
    );
    return data.data;
  },
  async registrarChegada(input: CreateChegadaInput): Promise<AtendimentoPS> {
    const { data } = await api.post<ApiEnvelope<AtendimentoPS>>(
      '/pronto-socorro',
      input,
    );
    return data.data;
  },
  async chamar(id: string): Promise<AtendimentoPS> {
    const { data } = await api.post<ApiEnvelope<AtendimentoPS>>(
      `/pronto-socorro/${id}/chamar`,
    );
    return data.data;
  },
  async finalizar(
    id: string,
    input: FinalizarPsInput,
  ): Promise<AtendimentoPS> {
    const { data } = await api.post<ApiEnvelope<AtendimentoPS>>(
      `/pronto-socorro/${id}/finalizar`,
      input,
    );
    return data.data;
  },
};

// --- Hooks React Query -----------------------------------------------------
export function useFilaPS() {
  return useQuery({
    queryKey: clinicalKeys.ps.fila,
    queryFn: emergenciaService.fila,
    // Fila do PS muda rápido: refaz a cada 15s enquanto a tela está aberta.
    refetchInterval: 15_000,
  });
}

export function useRegistrarChegada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChegadaInput) =>
      emergenciaService.registrarChegada(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinicalKeys.ps.fila }),
  });
}

export function useChamarPaciente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emergenciaService.chamar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinicalKeys.ps.fila }),
  });
}

export function useFinalizarPS() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FinalizarPsInput }) =>
      emergenciaService.finalizar(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clinicalKeys.ps.fila }),
  });
}
