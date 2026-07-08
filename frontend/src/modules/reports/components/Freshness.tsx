'use client';

import { Badge } from '@/components/ui/primitives';

const STALE_MS = 10 * 60_000; // 10 min

/** "Atualizado em ..." + badge "Desatualizado" quando o refresh está velho. */
export function Freshness({ atualizadoEm }: { atualizadoEm: string | null | undefined }) {
  if (!atualizadoEm) {
    return <span className="text-xs text-slate-400">Sem dados de atualização</span>;
  }
  const data = new Date(atualizadoEm);
  const stale = Date.now() - data.getTime() > STALE_MS;
  return (
    <span className="flex items-center gap-2 text-xs text-slate-400">
      Atualizado em {data.toLocaleString('pt-BR')}
      {stale && <Badge tone="amber">Desatualizado</Badge>}
    </span>
  );
}
