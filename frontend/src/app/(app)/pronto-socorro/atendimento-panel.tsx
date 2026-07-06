'use client';

import { useState } from 'react';
import { FlaskConical, Pill, Plus, Trash2, X } from 'lucide-react';
import { apiErrorMessage } from '@/services/api';
import { Can } from '@/modules/shared/rbac/Can';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
} from '@/components/ui/primitives';
import {
  useExamesPaciente,
  useRegistrarResultado,
  useSolicitarExame,
  useTiposExame,
} from '@/modules/clinical/exames';
import { useCriarPrescricao } from '@/modules/clinical/prescricao';
import { useFinalizarPS } from '@/modules/clinical/emergencia';
import type {
  AtendimentoPS,
  ExameSolicitado,
  ItemPrescricaoHospInput,
} from '@/modules/clinical/types';

export function AtendimentoPanel({
  atendimento,
  onClose,
}: {
  atendimento: AtendimentoPS;
  onClose: () => void;
}) {
  const pacienteId = atendimento.pacienteId;
  return (
    <Card className="divide-y divide-slate-100">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {atendimento.paciente?.nome ?? `Paciente ${pacienteId}`}
          </p>
          <p className="text-xs text-slate-500">{atendimento.motivoConsulta}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Can any={['exam:write']} fallback={<div className="hidden" />}>
        <ExamesSection pacienteId={pacienteId} />
      </Can>

      <Can any={['prescription:write', 'prescription:create']}>
        <PrescricaoSection pacienteId={pacienteId} />
      </Can>

      <Can any={['emergency:write']}>
        <DesfechoSection atendimentoId={atendimento.id} onDone={onClose} />
      </Can>
    </Card>
  );
}

// --- Exames ----------------------------------------------------------------
function ExamesSection({ pacienteId }: { pacienteId: string }) {
  const tipos = useTiposExame();
  const exames = useExamesPaciente(pacienteId);
  const solicitar = useSolicitarExame(pacienteId);
  const [tipoId, setTipoId] = useState('');
  const [urgencia, setUrgencia] = useState<'rotina' | 'urgente' | 'urgentissimo'>('rotina');
  const [erro, setErro] = useState<string | null>(null);

  async function handleSolicitar() {
    setErro(null);
    if (!tipoId) {
      setErro('Escolha o tipo de exame.');
      return;
    }
    try {
      await solicitar.mutateAsync({ pacienteId, tipoExameId: tipoId, urgencia });
      setTipoId('');
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <section className="space-y-2 px-4 py-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <FlaskConical className="h-4 w-4" /> Exames
      </h3>
      <div className="flex gap-2">
        <select
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">Tipo de exame…</option>
          {tipos.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} — {t.nome}
            </option>
          ))}
        </select>
        <select
          value={urgencia}
          onChange={(e) =>
            setUrgencia(e.target.value as 'rotina' | 'urgente' | 'urgentissimo')
          }
          className="rounded-md border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="rotina">Rotina</option>
          <option value="urgente">Urgente</option>
          <option value="urgentissimo">Urgentíssimo</option>
        </select>
        <Button
          variant="secondary"
          loading={solicitar.isPending}
          onClick={handleSolicitar}
        >
          Solicitar
        </Button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <ul className="space-y-1">
        {exames.data?.map((ex) => (
          <ExameItem key={ex.id} exame={ex} pacienteId={pacienteId} />
        ))}
      </ul>
    </section>
  );
}

function ExameItem({
  exame,
  pacienteId,
}: {
  exame: ExameSolicitado;
  pacienteId: string;
}) {
  const registrar = useRegistrarResultado(pacienteId);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [interpretacao, setInterpretacao] = useState<
    'normal' | 'alterado' | 'critico' | 'indeterminado'
  >('normal');
  const [erro, setErro] = useState<string | null>(null);
  const finalizado = exame.status === 'resultado_disponivel';

  async function salvar() {
    setErro(null);
    try {
      await registrar.mutateAsync({
        id: exame.id,
        input: { resultadoTexto: texto, interpretacao },
      });
      setAberto(false);
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <li className="rounded-md bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-700">
          {exame.tipoExame?.codigo ?? 'Exame'} — {exame.tipoExame?.nome}
        </span>
        <div className="flex items-center gap-2">
          <Badge tone={finalizado ? 'green' : 'amber'}>{exame.status}</Badge>
          {!finalizado && (
            <button
              className="text-xs text-clinic-primary hover:underline"
              onClick={() => setAberto((v) => !v)}
            >
              Resultado
            </button>
          )}
        </div>
      </div>
      {finalizado && exame.resultadoTexto && (
        <p className="mt-1 text-xs text-slate-500">{exame.resultadoTexto}</p>
      )}
      {aberto && !finalizado && (
        <div className="mt-2 space-y-2">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descrição do resultado"
          />
          <div className="flex gap-2">
            <select
              value={interpretacao}
              onChange={(e) =>
                setInterpretacao(
                  e.target.value as
                    | 'normal'
                    | 'alterado'
                    | 'critico'
                    | 'indeterminado',
                )
              }
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="normal">Normal</option>
              <option value="alterado">Alterado</option>
              <option value="critico">Crítico</option>
              <option value="indeterminado">Indeterminado</option>
            </select>
            <Button loading={registrar.isPending} onClick={salvar}>
              Salvar
            </Button>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
      )}
    </li>
  );
}

// --- Prescrição hospitalar -------------------------------------------------
const ITEM_VAZIO: ItemPrescricaoHospInput = {
  nomeLivre: '',
  dose: '',
  via: '',
  frequencia: '',
};

function PrescricaoSection({ pacienteId }: { pacienteId: string }) {
  const criar = useCriarPrescricao(pacienteId);
  const [itens, setItens] = useState<ItemPrescricaoHospInput[]>([{ ...ITEM_VAZIO }]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function setItem(i: number, patch: Partial<ItemPrescricaoHospInput>) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function handleCriar() {
    setErro(null);
    setOk(false);
    const validos = itens.filter((i) => i.nomeLivre?.trim());
    if (validos.length === 0) {
      setErro('Adicione ao menos um medicamento.');
      return;
    }
    try {
      await criar.mutateAsync({ pacienteId, itens: validos });
      setItens([{ ...ITEM_VAZIO }]);
      setOk(true);
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <section className="space-y-2 px-4 py-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Pill className="h-4 w-4" /> Prescrição
      </h3>
      {itens.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5">
          <Input
            className="col-span-5"
            placeholder="Medicamento"
            value={item.nomeLivre}
            onChange={(e) => setItem(i, { nomeLivre: e.target.value })}
          />
          <Input
            className="col-span-2"
            placeholder="Dose"
            value={item.dose}
            onChange={(e) => setItem(i, { dose: e.target.value })}
          />
          <Input
            className="col-span-2"
            placeholder="Via"
            value={item.via}
            onChange={(e) => setItem(i, { via: e.target.value })}
          />
          <Input
            className="col-span-2"
            placeholder="Freq."
            value={item.frequencia}
            onChange={(e) => setItem(i, { frequencia: e.target.value })}
          />
          <button
            className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-500"
            onClick={() =>
              setItens((prev) =>
                prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev,
              )
            }
            aria-label="Remover item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1 text-xs text-clinic-primary hover:underline"
          onClick={() => setItens((prev) => [...prev, { ...ITEM_VAZIO }])}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
        <Button loading={criar.isPending} onClick={handleCriar}>
          Prescrever
        </Button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {ok && <p className="text-xs text-emerald-600">Prescrição criada.</p>}
    </section>
  );
}

// --- Desfecho --------------------------------------------------------------
function DesfechoSection({
  atendimentoId,
  onDone,
}: {
  atendimentoId: string;
  onDone: () => void;
}) {
  const finalizar = useFinalizarPS();
  const [desfecho, setDesfecho] = useState<'alta' | 'internado' | 'obito'>('alta');
  const [conduta, setConduta] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function handleFinalizar() {
    setErro(null);
    try {
      await finalizar.mutateAsync({
        id: atendimentoId,
        input: { desfecho, conduta: conduta.trim() || undefined },
      });
      onDone();
    } catch (e) {
      setErro(apiErrorMessage(e));
    }
  }

  return (
    <section className="space-y-2 px-4 py-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Desfecho
      </h3>
      <div className="flex gap-2">
        <select
          value={desfecho}
          onChange={(e) =>
            setDesfecho(e.target.value as 'alta' | 'internado' | 'obito')
          }
          className="flex-1 rounded-md border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="alta">Alta</option>
          <option value="internado">Internado</option>
          <option value="obito">Óbito</option>
        </select>
        <Button
          variant="danger"
          loading={finalizar.isPending}
          onClick={handleFinalizar}
        >
          Finalizar
        </Button>
      </div>
      <Input
        value={conduta}
        onChange={(e) => setConduta(e.target.value)}
        placeholder="Conduta / observações"
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </section>
  );
}
