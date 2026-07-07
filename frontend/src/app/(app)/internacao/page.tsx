'use client';

import { useState } from 'react';
import { BedDouble, LogOut, Plus, X } from 'lucide-react';
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
import { cn } from '@/utils/cn';
import { PdfButton } from '@/components/pdf/PdfButton';
import {
  pdfErrorMessage,
  useDownloadAlta,
} from '@/modules/pdf/hooks/useDownloadPdf';
import type { Paciente } from '@/types';
import {
  useDarAlta,
  useEvoluir,
  useInternacoesAtivas,
  useInternar,
  useLeitos,
} from '@/modules/clinical/internacao';
import type {
  Internacao,
  Leito,
  LeitoStatus,
} from '@/modules/clinical/types';

const LEITO_STATUS: Record<LeitoStatus, { label: string; cls: string }> = {
  livre: { label: 'Livre', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  ocupado: { label: 'Ocupado', cls: 'border-red-300 bg-red-50 text-red-700' },
  reservado: { label: 'Reservado', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  em_higienizacao: { label: 'Higienização', cls: 'border-slate-300 bg-slate-100 text-slate-600' },
  interditado: { label: 'Interditado', cls: 'border-slate-300 bg-slate-100 text-slate-500' },
};

export default function InternacaoPage() {
  const leitos = useLeitos();
  const ativas = useInternacoesAtivas();
  const [internarAberto, setInternarAberto] = useState(false);
  const [selecionada, setSelecionada] = useState<Internacao | null>(null);

  return (
    <div>
      <PageHeader
        title="Internação / Leitos"
        subtitle="Mapa de ocupação e gestão de internações"
        actions={
          <Can any={['internment:write']}>
            <Button onClick={() => setInternarAberto((v) => !v)}>
              <Plus className="h-4 w-4" />
              Internar paciente
            </Button>
          </Can>
        }
      />

      {internarAberto && (
        <InternarForm
          leitosLivres={(leitos.data ?? []).filter((l) => l.status === 'livre')}
          onClose={() => setInternarAberto(false)}
        />
      )}

      {/* Mapa de leitos */}
      <Card className="mb-4">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          Mapa de leitos
        </div>
        {leitos.isLoading ? (
          <TableSkeleton rows={3} />
        ) : leitos.isError ? (
          <ErrorState
            message={apiErrorMessage(leitos.error)}
            onRetry={() => leitos.refetch()}
          />
        ) : (leitos.data ?? []).length === 0 ? (
          <EmptyState title="Nenhum leito cadastrado" />
        ) : (
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 lg:grid-cols-6">
            {leitos.data!.map((l) => (
              <LeitoCell key={l.id} leito={l} />
            ))}
          </div>
        )}
      </Card>

      {/* Internações ativas + painel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            Internações ativas ({ativas.data?.items.length ?? 0})
          </div>
          {ativas.isLoading ? (
            <TableSkeleton rows={4} />
          ) : ativas.isError ? (
            <ErrorState
              message={apiErrorMessage(ativas.error)}
              onRetry={() => ativas.refetch()}
            />
          ) : (ativas.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Sem internações ativas" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ativas.data!.items.map((i) => (
                <li
                  key={i.id}
                  className={cn(
                    'cursor-pointer px-4 py-3 hover:bg-slate-50',
                    selecionada?.id === i.id && 'bg-clinic-primary/5',
                  )}
                  onClick={() => setSelecionada(i)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      {i.paciente?.nome ?? `Paciente ${i.pacienteId}`}
                    </span>
                    <Badge tone="blue">Leito {i.leitoRef?.numero ?? i.leito}</Badge>
                  </div>
                  <p className="truncate text-xs text-slate-500">{i.motivo}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div>
          {selecionada ? (
            <InternacaoPanel
              internacao={selecionada}
              onClose={() => setSelecionada(null)}
            />
          ) : (
            <Card className="p-6 text-center text-sm text-slate-400">
              <BedDouble className="mx-auto mb-2 h-6 w-6 text-slate-300" />
              Selecione uma internação para evoluir ou dar alta.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LeitoCell({ leito }: { leito: Leito }) {
  const s = LEITO_STATUS[leito.status];
  return (
    <div className={cn('rounded-md border p-2 text-center', s.cls)}>
      <p className="text-sm font-semibold">{leito.numero}</p>
      <p className="text-[10px] uppercase tracking-wide">{s.label}</p>
    </div>
  );
}

function InternarForm({
  leitosLivres,
  onClose,
}: {
  leitosLivres: Leito[];
  onClose: () => void;
}) {
  const internar = useInternar();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [leitoId, setLeitoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit() {
    setErro(null);
    if (!paciente || !leitoId || !motivo.trim()) {
      setErro('Selecione paciente, leito e informe o motivo.');
      return;
    }
    try {
      await internar.mutateAsync({
        pacienteId: paciente.id,
        leitoId,
        motivo: motivo.trim(),
      });
      onClose();
    } catch (e) {
      setErro(apiErrorMessage(e)); // ex.: 409 "Leito não está livre"
    }
  }

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Internar paciente</h2>
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
          <Field label="Leito livre">
            <select
              value={leitoId}
              onChange={(e) => setLeitoId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Selecione…</option>
              {leitosLivres.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.numero} {l.setor?.sigla ? `(${l.setor.sigla})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motivo da internação">
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Observação cardiológica"
            />
          </Field>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button
            className="w-full"
            loading={internar.isPending}
            onClick={handleSubmit}
          >
            Confirmar internação
          </Button>
        </div>
      </div>
    </Card>
  );
}

function InternacaoPanel({
  internacao,
  onClose,
}: {
  internacao: Internacao;
  onClose: () => void;
}) {
  const evoluir = useEvoluir(internacao.id);
  const darAlta = useDarAlta();
  const downloadAlta = useDownloadAlta();
  const [subjetivo, setSubjetivo] = useState('');
  const [avaliacao, setAvaliacao] = useState('');
  const [tipoAlta, setTipoAlta] = useState<'melhorado' | 'curado' | 'transferencia' | 'obito'>('melhorado');
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [altaConcluida, setAltaConcluida] = useState(false);

  async function handleEvoluir() {
    setErro(null);
    setMsg(null);
    if (!subjetivo.trim() && !avaliacao.trim()) {
      setErro('Preencha ao menos S ou A da evolução.');
      return;
    }
    try {
      await evoluir.mutateAsync({
        tipo: 'medica',
        subjetivo: subjetivo.trim() || undefined,
        avaliacao: avaliacao.trim() || undefined,
      });
      setSubjetivo('');
      setAvaliacao('');
      setMsg('Evolução registrada.');
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  async function handleAlta() {
    setErro(null);
    try {
      await darAlta.mutateAsync({ id: internacao.id, input: { tipoAlta } });
      // Mantém o painel aberto para permitir a emissão do resumo de alta (PDF).
      setAltaConcluida(true);
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <Card className="divide-y divide-slate-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {internacao.paciente?.nome ?? `Paciente ${internacao.pacienteId}`}
          </p>
          <p className="text-xs text-slate-500">
            Leito {internacao.leitoRef?.numero ?? internacao.leito}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Can any={['internment:write']}>
        <section className="space-y-2 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evolução (SOAP)
          </h3>
          <Input
            value={subjetivo}
            onChange={(e) => setSubjetivo(e.target.value)}
            placeholder="Subjetivo (queixa/relato)"
          />
          <Input
            value={avaliacao}
            onChange={(e) => setAvaliacao(e.target.value)}
            placeholder="Avaliação (impressão clínica)"
          />
          <Button
            variant="secondary"
            className="w-full"
            loading={evoluir.isPending}
            onClick={handleEvoluir}
          >
            Registrar evolução
          </Button>
          {msg && <p className="text-xs text-emerald-600">{msg}</p>}
        </section>

        <section className="space-y-2 px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <LogOut className="h-4 w-4" /> Alta
          </h3>
          {altaConcluida ? (
            <div className="space-y-2">
              <p className="text-xs text-emerald-600">
                Alta registrada. Emita o resumo de alta:
              </p>
              <div className="flex items-center gap-3">
                <PdfButton
                  label="Resumo de alta (PDF)"
                  loading={downloadAlta.isPending}
                  onClick={() => downloadAlta.mutate(internacao.id)}
                />
                <Button variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
              </div>
              {downloadAlta.isError && (
                <p className="text-xs text-red-600">
                  {pdfErrorMessage(downloadAlta.error)}
                </p>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={tipoAlta}
                onChange={(e) =>
                  setTipoAlta(
                    e.target.value as
                      | 'melhorado'
                      | 'curado'
                      | 'transferencia'
                      | 'obito',
                  )
                }
                className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
              >
                <option value="melhorado">Melhorado</option>
                <option value="curado">Curado</option>
                <option value="transferencia">Transferência</option>
                <option value="obito">Óbito</option>
              </select>
              <Button
                variant="danger"
                loading={darAlta.isPending}
                onClick={handleAlta}
              >
                Dar alta
              </Button>
            </div>
          )}
        </section>
      </Can>

      {erro && <p className="px-4 py-2 text-xs text-red-600">{erro}</p>}
    </Card>
  );
}
