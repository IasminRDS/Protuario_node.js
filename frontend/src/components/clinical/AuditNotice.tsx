'use client';

import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * Feedback explícito de auditoria (P0.2 §3.7): toda ação sensível/registrada
 * deve ser reconhecível pelo operador — reforça não-repúdio (o usuário sabe que
 * a ação ficou registrada). Texto padrão: "Ação registrada em auditoria".
 */
export function AuditNotice({ children }: { children?: ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
      role="status"
    >
      <ShieldCheck className="h-4 w-4" aria-hidden />
      {children ?? 'Ação registrada em auditoria'}
    </div>
  );
}
