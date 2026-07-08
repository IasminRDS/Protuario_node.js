'use client';

import { Clock } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Freshness } from './Freshness';
import type { TempoMedio } from '../types';

export function TempoMedioCard({
  data,
  isLoading,
}: {
  data?: TempoMedio;
  isLoading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Clock className="h-4 w-4 text-clinic-primary" /> Tempo médio de atendimento
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-10 w-28" />
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {(data?.mediaMinutos ?? 0).toLocaleString('pt-BR')} min
          </p>
          <p className="text-xs text-slate-500">
            base: {data?.totalAtendimentos ?? 0} atendimentos finalizados
          </p>
          <div className="mt-3">
            <Freshness atualizadoEm={data?.atualizadoEm} />
          </div>
        </>
      )}
    </Card>
  );
}
