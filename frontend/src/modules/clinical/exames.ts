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
  ExameSolicitado,
  RegistrarResultadoInput,
  SolicitarExameInput,
  TipoExame,
} from './types';

export const examesService = {
  async tipos(): Promise<TipoExame[]> {
    const { data } = await api.get<ApiEnvelope<TipoExame[]>>('/exames/tipos');
    return data.data;
  },
  async porPaciente(pacienteId: string): Promise<ExameSolicitado[]> {
    const { data } = await api.get<ApiEnvelope<ExameSolicitado[]>>(
      `/exames/paciente/${pacienteId}`,
    );
    return data.data;
  },
  async solicitar(input: SolicitarExameInput): Promise<ExameSolicitado> {
    const { data } = await api.post<ApiEnvelope<ExameSolicitado>>(
      '/exames',
      input,
    );
    return data.data;
  },
  async registrarResultado(
    id: string,
    input: RegistrarResultadoInput,
  ): Promise<ExameSolicitado> {
    const { data } = await api.patch<ApiEnvelope<ExameSolicitado>>(
      `/exames/${id}/resultado`,
      input,
    );
    return data.data;
  },
};

export function useTiposExame() {
  return useQuery({
    queryKey: clinicalKeys.tiposExame,
    queryFn: examesService.tipos,
    staleTime: 5 * 60_000, // catálogo muda pouco
  });
}

export function useExamesPaciente(pacienteId: string | null) {
  return useQuery({
    queryKey: clinicalKeys.examesByPaciente(pacienteId ?? ''),
    queryFn: () => examesService.porPaciente(pacienteId as string),
    enabled: !!pacienteId,
  });
}

export function useSolicitarExame(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SolicitarExameInput) =>
      examesService.solicitar(input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: clinicalKeys.examesByPaciente(pacienteId),
      }),
  });
}

export function useRegistrarResultado(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: RegistrarResultadoInput;
    }) => examesService.registrarResultado(id, input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: clinicalKeys.examesByPaciente(pacienteId),
      }),
  });
}
