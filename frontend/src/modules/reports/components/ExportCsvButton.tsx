'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { type CsvColumn, downloadCsv, toCsv } from '../lib/csv';

/** Botão genérico de exportação CSV — reaproveitável para qualquer tabela. */
export function ExportCsvButton<T extends object>({
  rows,
  columns,
  tipo,
  label = 'Exportar CSV',
}: {
  rows: T[];
  columns?: CsvColumn<T>[];
  tipo: string;
  label?: string;
}) {
  return (
    <Button
      variant="secondary"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(toCsv(rows, columns), tipo)}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
