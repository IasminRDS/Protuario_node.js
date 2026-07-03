'use client';

import Link from 'next/link';
import { FileText, Lock, ShieldAlert } from 'lucide-react';
import { Drawer } from '@/modules/shared/ui/Drawer';
import { StatusBadge } from '@/modules/shared/ui/StatusBadge';
import { Button } from '@/components/ui/primitives';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import { useSoftLock } from '@/modules/shared/hooks/useSoftLock';
import { allowedTransitions } from '@/modules/shared/clinical/patient-status';
import type { PatientView } from './types';

export function PatientDrawer({
  patient,
  onClose,
}: {
  patient: PatientView | null;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const { state, holder } = useSoftLock('prontuario', patient?.id ?? null);

  return (
    <Drawer open={!!patient} onClose={onClose} title="Ficha do paciente">
      {patient && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-800">{patient.nome}</h3>
              <StatusBadge status={patient.status} />
            </div>
            <p className="text-sm text-slate-500">
              {patient.sexo} ·{' '}
              {new Date(patient.dataNascimento).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Concorrência: indicador de soft-lock */}
          {state === 'HELD_BY_OTHER' && (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Lock className="h-4 w-4" /> Em edição por {holder ?? 'outro profissional'}.
            </div>
          )}
          {state === 'UNAVAILABLE' && (
            <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <ShieldAlert className="h-4 w-4" /> Controle de concorrência (/locks) ainda não ativo no backend.
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">CPF</dt>
              <dd className="text-slate-700">{patient.cpf ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">CNS</dt>
              <dd className="text-slate-700">{patient.cns ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Telefone</dt>
              <dd className="text-slate-700">{patient.telefone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">E-mail</dt>
              <dd className="text-slate-700">{patient.email ?? '—'}</dd>
            </div>
          </dl>

          {/* Transições do fluxo clínico (FSM) — gated por permissão.
              Executam quando os endpoints clínicos existirem. */}
          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">
              Próximas etapas do fluxo
            </p>
            <div className="flex flex-wrap gap-2">
              {allowedTransitions(patient.status).map((t) =>
                can(t.permission) ? (
                  <Button
                    key={t.to}
                    variant="secondary"
                    title="Requer endpoint clínico no backend"
                    onClick={() => alert(`Ação "${t.action}" — endpoint clínico pendente no backend.`)}
                  >
                    {t.action}
                  </Button>
                ) : null,
              )}
              {allowedTransitions(patient.status).length === 0 && (
                <span className="text-xs text-slate-400">Fluxo encerrado.</span>
              )}
            </div>
          </div>

          <Link
            href={`/pacientes/${patient.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-clinic-primary hover:underline"
          >
            <FileText className="h-4 w-4" /> Abrir prontuário completo
          </Link>
        </div>
      )}
    </Drawer>
  );
}
