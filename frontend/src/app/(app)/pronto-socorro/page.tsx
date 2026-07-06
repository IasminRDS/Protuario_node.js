'use client';

import { useMemo, useState } from 'react';
import { Plus, PhoneCall, Stethoscope, X } from 'lucide-react';
import { apiErrorMessage } from '@/services/api';
import { Can } from '@/modules/shared/rbac/Can';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  TableSkeleton,
} from '@/components/ui/primitives';
import type { Paciente } from '@/types';
import {
  useChamarPaciente,
  useFilaPS,
  useRegistrarChegada,
} from '@/modules/clinical/emergencia';
import type { AtendimentoPS, PsStatus } from '@/modules/clinical/types';
import { AtendimentoPanel } from './atendimento-panel';

const STATUS_TONE: Record<PsStatus, 'slate' | 'amber' | 'blue' | 'green' | 'red'> = {
  em_espera: 'amber',
  em_atendimento: 'blue',
  internado: 'slate',
  alta: 'green',
  obito: 'red',
};
const STATUS_LABEL: Record<PsStatus, string> = {
  em_espera: 'Aguardando',
  em_atendimento: 'Em atendimento',
  internado: 'Internado',
  alta: 'Alta',
  obito: 'Óbito',
};

export default function ProntoSocorroPage() {
  const fila = useFilaPS();
  const [chegadaAberta, setChegadaAberta] = useState(false);
  const [emAtendimento, setEmAtendimento] = useState<AtendimentoPS | null>(null);

  const ordenada = useMemo(
    () =>
      [...(fila.data ?? [])].sort(
        (a, b) =>
          new Date(a.dataChegada).getTime() - new Date(b.dataChegada).getTime(),
      ),
    [fila.data],
  );

  return (
    <div>
      <PageHeader
        title="Pronto-Socorro"
        subtitle="Fila de espera e atendimento em tempo real"
        actions={
          <Can any={['emergency:write']}>
            <Button onClick={() => setChegadaAberta((v) => !v)}>
              <Plus className="h-4 w-4" />
              Registrar chegada
            </Button>
          </Can>
        }
      />

      {chegadaAberta && <ChegadaForm onClose={() => setChegadaAberta(false)} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            Fila ({ordenada.length})
          </div>
          {fila.isLoading ? (
            <TableSkeleton rows={5} />
          ) : fila.isError ? (
            <ErrorState
              message={apiErrorMessage(fila.error)}
              onRetry={() => fila.refetch()}
            />
          ) : ordenada.length === 0 ? (
            <EmptyState
              title="Fila vazia"
              hint="Nenhum paciente aguardando ou em atendimento."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ordenada.map((a) => (
                <FilaRow key={a.id} atendimento={a} onAtender={setEmAtendimento} />
              ))}
            </ul>
          )}
        </Card>

        <div>
          {emAtendimento ? (
            <AtendimentoPanel
              atendimento={emAtendimento}
              onClose={() => setEmAtendimento(null)}
            />
          ) : (
            <Card className="p-6 text-center text-sm text-slate-400">
              <Stethoscope className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              Selecione um paciente em atendimento para registrar exames,
              prescrição e desfecho.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FilaRow({
  atendimento,
  onAtender,
}: {
  atendimento: AtendimentoPS;
  onAtender: (a: AtendimentoPS) => void;
}) {
  const chamar = useChamarPaciente();
  const [erro, setErro] = useState<string | null>(null);

  async function handleChamar() {
    setErro(null);
    try {
      const atualizado = await chamar.mutateAsync(atendimento.id);
      onAtender({ ...atendimento, ...atualizado });
    } catch (e) {
      setErro(apiErrorMessage(e)); // ex.: 409 "Paciente não está aguardando"
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-slate-800">
            {atendimento.paciente?.nome ?? `Paciente ${atendimento.pacienteId}`}
          </span>
          <Badge tone={STATUS_TONE[atendimento.status]}>
            {STATUS_LABEL[atendimento.status]}
          </Badge>
        </div>
        <p className="truncate text-xs text-slate-500">
          {atendimento.motivoConsulta} ·{' '}
          {new Date(atendimento.dataChegada).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
      </div>

      <Can any={['emergency:write']}>
        {atendimento.status === 'em_espera' ? (
          <Button
            variant="secondary"
            loading={chamar.isPending}
            onClick={handleChamar}
          >
            <PhoneCall className="h-4 w-4" />
            Chamar
          </Button>
        ) : atendimento.status === 'em_atendimento' ? (
          <Button variant="ghost" onClick={() => onAtender(atendimento)}>
            <Stethoscope className="h-4 w-4" />
            Atender
          </Button>
        ) : null}
      </Can>
    </li>
  );
}

function ChegadaForm({ onClose }: { onClose: () => void }) {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const registrar = useRegistrarChegada();

  async function handleSubmit() {
    setErro(null);
    if (!paciente || !motivo.trim()) {
      setErro('Selecione o paciente e informe o motivo.');
      return;
    }
    try {
      await registrar.mutateAsync({
        pacienteId: paciente.id,
        motivoConsulta: motivo.trim(),
      });
      onClose();
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Registrar chegada ao PS
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Paciente
          </span>
          <PatientPicker selected={paciente} onSelect={setPaciente} />
        </div>
        <div className="space-y-3">
          <Field label="Motivo da consulta">
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Dor torácica há 2h"
            />
          </Field>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button
            className="w-full"
            loading={registrar.isPending}
            onClick={handleSubmit}
          >
            Registrar na fila
          </Button>
        </div>
      </div>
    </Card>
  );
}
