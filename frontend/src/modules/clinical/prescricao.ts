'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/services/api';
import type { ApiEnvelope } from '@/types';
import { clinicalKeys } from './keys';
import type { CreatePrescricaoHospInput, PrescricaoHosp } from './types';

export const prescricaoService = {
  async porPaciente(pacienteId: string): Promise<PrescricaoHosp[]> {
    const { data } = await api.get<ApiEnvelope<PrescricaoHosp[]>>(
      `/prescricao-hospitalar/paciente/${pacienteId}`,
    );
    return data.data;
  },
  async criar(input: CreatePrescricaoHospInput): Promise<PrescricaoHosp> {
    const { data } = await api.post<ApiEnvelope<PrescricaoHosp>>(
      '/prescricao-hospitalar',
      input,
    );
    return data.data;
  },
  async administrar(
    itemId: string,
    input: { status: 'realizado' | 'recusado' | 'atrasado'; observacoes?: string },
  ): Promise<unknown> {
    const { data } = await api.post<ApiEnvelope<unknown>>(
      `/prescricao-hospitalar/item/${itemId}/administrar`,
      input,
    );
    return data.data;
  },
  async suspender(id: string): Promise<PrescricaoHosp> {
    const { data } = await api.post<ApiEnvelope<PrescricaoHosp>>(
      `/prescricao-hospitalar/${id}/suspender`,
    );
    return data.data;
  },
};

export function usePrescricoesPaciente(pacienteId: string | null) {
  return useQuery({
    queryKey: clinicalKeys.prescricoesByPaciente(pacienteId ?? ''),
    queryFn: () => prescricaoService.porPaciente(pacienteId as string),
    enabled: !!pacienteId,
  });
}

export function useCriarPrescricao(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePrescricaoHospInput) =>
      prescricaoService.criar(input),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: clinicalKeys.prescricoesByPaciente(pacienteId),
      }),
  });
}

export function useAdministrarItem(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      status,
      observacoes,
    }: {
      itemId: string;
      status: 'realizado' | 'recusado' | 'atrasado';
      observacoes?: string;
    }) => prescricaoService.administrar(itemId, { status, observacoes }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: clinicalKeys.prescricoesByPaciente(pacienteId),
      }),
  });
}
