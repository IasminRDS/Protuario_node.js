'use client';

import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { PacienteConsistencyState } from '@/types';

/** Tooltip de bloqueio para ações desabilitadas em registros não-VÁLIDOS. */
export const QUARANTINE_TOOLTIP =
  'Registro bloqueado por inconsistência de vínculo institucional.';

const META: Record<
  PacienteConsistencyState,
  { label: string; tip: string; cls: string; Icon: typeof ShieldCheck }
> = {
  VALIDO: {
    label: 'Vínculo institucional íntegro',
    tip: 'Registro válido — operação normal.',
    cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    Icon: ShieldCheck,
  },
  QUARENTENA: {
    label: 'Registro em quarentena clínica',
    tip: 'Registro sem vínculo institucional — bloqueado para mutação.',
    cls: 'bg-amber-100 text-amber-800 ring-amber-300',
    Icon: ShieldAlert,
  },
  INCONSISTENTE: {
    label: 'Registro clínico inconsistente',
    tip: 'Vínculo institucional quebrado (hospital inexistente) — bloqueado para mutação.',
    cls: 'bg-red-100 text-red-700 ring-red-300',
    Icon: AlertTriangle,
  },
};

/**
 * Renderiza o estado de consistência clínica (§3.1) — os 3 estados são visíveis
 * e tipados (VALIDO=verde, QUARENTENA=amarelo, INCONSISTENTE=vermelho). O estado
 * vem SEMPRE do backend (`consistencyState`); a UI nunca o infere. Só não
 * renderiza quando o backend não forneceu o campo (indefinido).
 */
export function ClinicalStateBadge({
  state,
}: {
  state?: PacienteConsistencyState;
}) {
  if (!state) return null;
  const { label, tip, cls, Icon } = META[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}
      title={tip}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
