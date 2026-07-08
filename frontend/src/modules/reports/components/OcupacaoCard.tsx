'use client';

import { BedDouble } from 'lucide-react';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Freshness } from './Freshness';
import type { OcupacaoLeitos } from '../types';

export function OcupacaoCard({
  data,
  isLoading,
}: {
  data?: OcupacaoLeitos;
  isLoading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <BedDouble className="h-4 w-4 text-clinic-primary" /> Ocupação de leitos
      </div>
      {isLoading ? (
        <Skeleton className="mt-3 h-10 w-28" />
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold text-slate-800">
            {(data?.taxaOcupacao ?? 0).toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">
            {data?.ocupados ?? 0} ocupados · {data?.livres ?? 0} livres ·{' '}
            {data?.total ?? 0} leitos
          </p>
          <div className="mt-3">
            <Freshness atualizadoEm={data?.atualizadoEm} />
          </div>
        </>
      )}
    </Card>
  );
}
