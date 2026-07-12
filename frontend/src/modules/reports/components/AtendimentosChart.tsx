'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { ExportCsvButton } from './ExportCsvButton';
import type { AtendimentoPorDia } from '../types';

export function AtendimentosChart({
  data,
  isLoading,
}: {
  data: AtendimentoPorDia[];
  isLoading: boolean;
}) {
  // O backend entrega desc; o gráfico de linha lê em ordem cronológica asc.
  const serie = [...data]
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((d) => ({ dia: d.dia.slice(5), total: d.totalAtendimentos }));

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Atendimentos por dia
        </h2>
        <ExportCsvButton
          tipo="atendimentos-por-dia"
          rows={data}
          columns={[
            { key: 'dia', label: 'Dia' },
            { key: 'totalAtendimentos', label: 'Total' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : serie.length === 0 ? (
        <EmptyState title="Sem atendimentos no período" />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={serie} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--color-chart-axis)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-chart-axis)' }} />
            <Tooltip
              labelFormatter={(l) => `Dia ${l}`}
              formatter={(v) => [v as number, 'Atendimentos']}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#0f766e"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
