'use client';

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { downloadFile } from '@/lib/download';

/**
 * Download de PDF é um SIDE-EFFECT (não é leitura de estado cacheável) →
 * `useMutation`, nunca `useQuery`. Os paths são relativos: o `api` já injeta
 * a baseURL `/api/v1`.
 */
export function useDownloadProntuario() {
  return useMutation({
    mutationFn: (pacienteId: string) =>
      downloadFile(`/pdf/paciente/${pacienteId}/prontuario`),
  });
}

export function useDownloadPrescricao() {
  return useMutation({
    mutationFn: (prescricaoId: string) =>
      downloadFile(`/pdf/prescricao/${prescricaoId}`),
  });
}

export function useDownloadAlta() {
  return useMutation({
    mutationFn: (internacaoId: string) =>
      downloadFile(`/pdf/alta/${internacaoId}`),
  });
}

/**
 * Mensagem de erro diferenciada por status. Em `responseType: 'blob'` o corpo
 * do erro é um Blob (não JSON), então diferenciamos pelo STATUS, não pelo corpo.
 */
export function pdfErrorMessage(error: unknown): string {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 403) return 'Sem permissão para gerar este documento.';
  if (status === 404) return 'Registro não encontrado.';
  if (status === 401) return 'Sessão expirada. Faça login novamente.';
  return 'Erro ao gerar o PDF. Tente novamente.';
}
