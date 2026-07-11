'use client';

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  exportPacientes,
  gerarBackup,
  type BackupFormat,
  type ExportFormat,
} from '../export.service';

/**
 * Mensagem de erro amigável para operações de export/backup. Como as respostas
 * vêm como `blob` (responseType), o corpo de erro não é JSON legível aqui — o
 * mapeamento é por STATUS, o que basta para o feedback ao usuário.
 */
export function exportErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return 'Falha na operação. Tente novamente.';
  switch (error.response?.status) {
    case 401:
      return 'Sessão expirada. Faça login novamente.';
    case 403:
      return 'Você não tem permissão para esta operação.';
    case 429:
      return 'Muitas solicitações. Aguarde um instante e tente novamente.';
    case 503:
      return 'Serviço indisponível no servidor (ex.: pg_dump não instalado).';
    case 500:
      return 'Falha ao gerar o arquivo no servidor.';
    default:
      return 'Falha na operação. Verifique sua conexão e tente novamente.';
  }
}

/** Export de pacientes (CSV ou JSON). Side-effect → useMutation. */
export function useExportPacientes() {
  return useMutation({
    mutationFn: (format: ExportFormat) => exportPacientes(format),
  });
}

/** Geração de backup (somente SuperAdmin no backend). */
export function useGerarBackup() {
  return useMutation({
    mutationFn: (format: BackupFormat) => gerarBackup(format),
  });
}
