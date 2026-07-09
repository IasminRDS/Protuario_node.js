'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { api } from '@/services/api';
import type { ApiEnvelope } from '@/types';
import type { ImportResponse } from '../types';

/**
 * Upload de CSV é side-effect → useMutation. Envia multipart/form-data pelo
 * client axios existente (mantém baseURL + Bearer + refresh). O `api` tem
 * Content-Type application/json por padrão; passamos 'multipart/form-data' para
 * sobrescrevê-lo — o adapter do axios remove esse header quando o corpo é
 * FormData no navegador, deixando o browser gerar o boundary correto.
 */
export function useImportPacientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ImportResponse> => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<ApiEnvelope<ImportResponse>>(
        '/csv/pacientes/import',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data.data;
    },
    // Import bem-sucedido altera a lista de pacientes.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pacientes'] }),
  });
}

export function importErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Falha ao importar. Tente novamente.';
  const status = error.response?.status;
  const body = error.response?.data as
    | { error?: { message?: string }; message?: string }
    | undefined;
  if (status === 403) return 'Você não tem permissão para importar pacientes.';
  if (status === 413) return 'Arquivo excede o limite de 5MB.';
  if (status === 400) {
    return body?.error?.message ?? body?.message ?? 'Arquivo CSV inválido.';
  }
  return 'Falha ao importar. Verifique o arquivo e tente novamente.';
}
