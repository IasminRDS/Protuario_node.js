'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { ExportCsvButton } from './ExportCsvButton';
import type { ExameRealizado } from '../types';

export function ExamesChart({
  data,
  isLoading,
}: {
  data: ExameRealizado[];
  isLoading: boolean;
}) {
  const serie = data.map((e) => ({
    codigo: e.codigo,
    total: e.total,
    tipo: e.tipoExame,
  }));

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Exames por tipo</h2>
        <ExportCsvButton
          tipo="exames"
          rows={data}
          columns={[
            { key: 'codigo', label: 'Código' },
            { key: 'tipoExame', label: 'Tipo de exame' },
            { key: 'total', label: 'Total' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : serie.length === 0 ? (
        <EmptyState title="Nenhum exame realizado" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis dataKey="codigo" tick={{ fontSize: 11, fill: 'var(--color-chart-axis)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-chart-axis)' }} />
            <Tooltip
              labelFormatter={(l, p) => (p?.[0]?.payload?.tipo as string) ?? String(l)}
              formatter={(v) => [v as number, 'Total']}
            />
            <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
