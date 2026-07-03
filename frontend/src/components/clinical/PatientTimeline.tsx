'use client';

import type { ProntuarioTimelineItem } from '@/services/prontuario.service';
import { Badge } from '@/components/ui/primitives';

const toneByType: Record<string, 'blue' | 'green' | 'amber' | 'slate'> = {
  ATENDIMENTO: 'blue',
  TRIAGEM: 'amber',
  PRESCRICAO: 'green',
  EXAME: 'slate',
  VACINA: 'green',
};

export function PatientTimeline({ items }: { items: ProntuarioTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">Sem registros clínicos.</p>;
  }
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-clinic-primary" />
          <div className="flex items-center gap-2">
            <Badge tone={toneByType[item.tipo] ?? 'slate'}>{item.tipo}</Badge>
            <span className="text-xs text-slate-400">
              {new Date(item.data).toLocaleString('pt-BR')}
            </span>
            {item.profissional && (
              <span className="text-xs text-slate-500">· {item.profissional}</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-700">{item.resumo}</p>
        </li>
      ))}
    </ol>
  );
}
