/**
 * Geração de CSV desacoplada e reutilizável para qualquer tabela.
 * - Separador ';' e BOM UTF-8 → abre corretamente no Excel pt-BR.
 * - Escapa aspas/quebras/;. Download via Blob (sem libs externas), com revoke.
 */
export interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

function escape(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /["\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T extends object>(
  rows: T[],
  columns?: CsvColumn<T>[],
): string {
  if (rows.length === 0) return '';
  const cols: CsvColumn<T>[] =
    columns ??
    (Object.keys(rows[0]) as (keyof T)[]).map((key) => ({ key, label: String(key) }));
  const header = cols.map((c) => escape(c.label)).join(';');
  const body = rows
    .map((r) => cols.map((c) => escape(r[c.key])).join(';'))
    .join('\n');
  return `${header}\n${body}`;
}

export function downloadCsv(csv: string, tipo: string): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `relatorio-${tipo}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
