import { api } from '@/services/api';

export type ExportFormat = 'csv' | 'json';
export type BackupFormat = 'sql' | 'dump';

/**
 * Dispara o download de uma resposta binária/stream no navegador, respeitando o
 * nome vindo do Content-Disposition do backend. Sem libs externas; revoga o
 * objectURL para não vazar memória entre downloads.
 */
function triggerBlobDownload(
  data: Blob,
  headers: Record<string, unknown>,
  fallbackName: string,
): void {
  const disposition = headers['content-disposition'] as string | undefined;
  const filename =
    disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName;
  const type =
    (headers['content-type'] as string | undefined) ?? 'application/octet-stream';

  const blob = new Blob([data], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Export tenant-safe de pacientes (CSV/JSON), em stream, com download automático. */
export async function exportPacientes(format: ExportFormat): Promise<void> {
  const res = await api.get<Blob>('/export/pacientes', {
    params: { format },
    responseType: 'blob',
  });
  const today = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(res.data, res.headers, `pacientes-${today}.${format}`);
}

/** Backup lógico global (pg_dump). Somente SuperAdmin — o backend reforça o RBAC. */
export async function gerarBackup(format: BackupFormat): Promise<void> {
  const res = await api.post<Blob>(
    '/backup',
    null,
    { params: { format }, responseType: 'blob' },
  );
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  triggerBlobDownload(res.data, res.headers, `backup-${ts}.${format}`);
}

/**
 * Registra no backend a EXPORTAÇÃO (client-side) de um relatório para a trilha
 * LGPD. Best-effort: nunca deve quebrar a experiência de download — se falhar,
 * o erro é apenas logado.
 */
export async function auditRelatorioExport(params: {
  relatorio: 'atendimentos-por-dia' | 'exames-realizados' | 'ocupacao-leitos' | 'tempo-medio';
  totalRegistros?: number;
}): Promise<void> {
  try {
    await api.post('/reports/export/audit', {
      relatorio: params.relatorio,
      formato: 'csv',
      totalRegistros: params.totalRegistros,
    });
  } catch {
    // Silencioso: a auditoria de relatório é complementar; não bloqueia a UI.
  }
}
