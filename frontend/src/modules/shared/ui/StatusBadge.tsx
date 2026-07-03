'use client';

import { STATUS_META, type PatientStatus } from '../clinical/patient-status';

const toneClasses: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-100 text-amber-800 ring-amber-200',
  blue: 'bg-blue-100 text-blue-700 ring-blue-200',
  teal: 'bg-teal-100 text-teal-700 ring-teal-200',
  violet: 'bg-violet-100 text-violet-700 ring-violet-200',
  green: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[meta.tone]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.colorVar }}
      />
      {meta.label}
    </span>
  );
}

/** Badge de classificação de risco (Manchester). */
const riskTone: Record<string, string> = {
  AZUL: 'bg-blue-100 text-blue-700',
  VERDE: 'bg-emerald-100 text-emerald-700',
  AMARELO: 'bg-amber-100 text-amber-800',
  LARANJA: 'bg-orange-100 text-orange-700',
  VERMELHO: 'bg-red-100 text-red-700',
};

export function RiskBadge({ risk }: { risk: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${riskTone[risk] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {risk}
    </span>
  );
}
