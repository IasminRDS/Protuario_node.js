import { api } from '@/services/api';

/**
 * Baixa um arquivo binário (ex.: PDF) da API real e dispara o download no
 * navegador. Usa o cliente axios existente (Bearer + refresh), `responseType:
 * 'blob'` (sem isso o binário corrompe) e o nome vindo do `Content-Disposition`
 * do backend. Sem libs externas; libera o objectURL para não vazar memória.
 */
export async function downloadFile(path: string): Promise<void> {
  const response = await api.get<Blob>(path, { responseType: 'blob' });

  const disposition = response.headers['content-disposition'] as
    | string
    | undefined;
  const filename =
    disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? 'documento.pdf';

  const type =
    (response.headers['content-type'] as string | undefined) ??
    'application/pdf';
  const blob = new Blob([response.data], { type });
  const href = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Libera o objectURL (evita vazamento de memória em múltiplos downloads).
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
