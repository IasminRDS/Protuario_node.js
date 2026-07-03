'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { pacientesService } from '@/services/pacientes.service';
import {
  prontuarioService,
  type ProntuarioTimelineItem,
} from '@/services/prontuario.service';
import { apiErrorMessage } from '@/services/api';
import {
  Card,
  Skeleton,
  Badge,
  ErrorState,
} from '@/components/ui/primitives';
import { PatientTimeline } from '@/components/clinical/PatientTimeline';
import type { Paciente } from '@/types';

export default function ProntuarioPacientePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [timeline, setTimeline] = useState<ProntuarioTimelineItem[] | null>(null);
  const [timelinePending, setTimelinePending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    pacientesService
      .getById(id)
      .then(setPaciente)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));

    // Timeline clínica: endpoint ainda não exposto -> estado "pendente".
    prontuarioService
      .getByPaciente(id)
      .then((p) => setTimeline(p.timeline))
      .catch(() => setTimelinePending(true));
  }, [id]);

  return (
    <div>
      <Link
        href="/pacientes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos pacientes
      </Link>

      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <ErrorState message={error} />
      ) : paciente ? (
        <>
          <Card className="mb-4 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-800">{paciente.nome}</h1>
                <p className="text-sm text-slate-500">
                  {paciente.sexo} ·{' '}
                  {new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>CPF: {paciente.cpf ?? '—'}</p>
                <p>CNS: {paciente.cns ?? '—'}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                Linha do tempo clínica
              </h2>
              {timelinePending && <Badge tone="amber">aguardando backend</Badge>}
            </div>

            {timelinePending ? (
              <p className="text-sm text-slate-500">
                O histórico clínico consolidado (<code>/prontuarios/:id</code>)
                ainda não é fornecido pelo backend. Assim que o endpoint existir,
                a linha do tempo (atendimentos, triagens, prescrições, exames)
                aparece aqui automaticamente.
              </p>
            ) : timeline ? (
              <PatientTimeline items={timeline} />
            ) : (
              <Skeleton className="h-24" />
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
