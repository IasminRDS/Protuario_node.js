'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeftRight, CalendarClock, Check, RotateCcw, X } from 'lucide-react';
import {
  regulacaoService,
  type AcaoRegulacao,
  type Encaminhamento,
} from '@/services/regulacao.service';
import { apiErrorMessage } from '@/services/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  TableSkeleton,
} from '@/components/ui/primitives';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import { CidPicker } from '@/components/clinical/TerminologyPicker';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import type { Paciente } from '@/types';

const PRIORIDADE_BADGE: Record<string, { tone: 'red' | 'amber' | 'blue'; rotulo: string }> = {
  emergencia: { tone: 'red', rotulo: 'Emergência' },
  urgencia: { tone: 'amber', rotulo: 'Urgência' },
  eletivo: { tone: 'blue', rotulo: 'Eletivo' },
};

const STATUS_BADGE: Record<string, { tone: 'slate' | 'green' | 'amber' | 'red' | 'blue'; rotulo: string }> = {
  solicitado: { tone: 'slate', rotulo: 'Solicitado' },
  em_analise: { tone: 'amber', rotulo: 'Em análise' },
  autorizado: { tone: 'green', rotulo: 'Autorizado' },
  agendado: { tone: 'blue', rotulo: 'Agendado' },
  realizado: { tone: 'green', rotulo: 'Realizado' },
  negado: { tone: 'red', rotulo: 'Negado' },
  devolvido: { tone: 'amber', rotulo: 'Devolvido' },
  cancelado: { tone: 'slate', rotulo: 'Cancelado' },
};

const schema = z.object({
  especialidade: z.string().min(1, 'Informe a especialidade'),
  prioridade: z.enum(['eletivo', 'urgencia', 'emergencia']),
  motivo: z.string().min(1, 'Descreva a justificativa clínica'),
  hipoteseDiagnostica: z.string().optional(),
  cid: z.string().optional(),
  servicoDestino: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegulacaoPage() {
  const { can } = usePermissions();
  const podeSolicitar = can('regulation:write');
  const podeRegular = can('regulation:decide');

  const [fila, setFila] = useState<Encaminhamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { prioridade: 'eletivo' },
    });

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setFila(await regulacaoService.fila());
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao carregar a fila de regulação.'));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function solicitar(data: FormData) {
    if (!paciente) {
      setErro('Selecione um paciente.');
      return;
    }
    setErro(null);
    setOkMsg(null);
    try {
      await regulacaoService.solicitar({ pacienteId: paciente.id, ...data });
      setOkMsg('Encaminhamento incluído na fila de regulação.');
      reset({ prioridade: 'eletivo' });
      setPaciente(null);
      await carregar();
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao solicitar encaminhamento.'));
    }
  }

  async function agir(item: Encaminhamento, acao: AcaoRegulacao) {
    let parecer: string | undefined;
    let dataAgendada: string | undefined;
    let unidadeDestino: string | undefined;

    if (acao === 'negar' || acao === 'devolver') {
      parecer = window.prompt('Parecer do regulador (obrigatório):')?.trim() || undefined;
      if (!parecer) return;
    }
    if (acao === 'agendar') {
      const quando = window.prompt('Data/hora agendada (AAAA-MM-DD HH:MM):')?.trim();
      if (!quando) return;
      const dt = new Date(quando.replace(' ', 'T'));
      if (Number.isNaN(dt.getTime())) {
        setErro('Data inválida. Use o formato AAAA-MM-DD HH:MM.');
        return;
      }
      dataAgendada = dt.toISOString();
      unidadeDestino =
        window.prompt('Unidade executante (opcional):')?.trim() || undefined;
    }

    setProcessando(item.id);
    setErro(null);
    try {
      await regulacaoService.regular(item.id, { acao, parecer, dataAgendada, unidadeDestino });
      await carregar();
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao aplicar a ação.'));
    } finally {
      setProcessando(null);
    }
  }

  function acoesDisponiveis(status: string): { acao: AcaoRegulacao; rotulo: string; icone: React.ReactNode }[] {
    switch (status) {
      case 'solicitado':
      case 'em_analise':
        return [
          { acao: 'autorizar', rotulo: 'Autorizar', icone: <Check className="h-4 w-4" /> },
          { acao: 'devolver', rotulo: 'Devolver', icone: <RotateCcw className="h-4 w-4" /> },
          { acao: 'negar', rotulo: 'Negar', icone: <X className="h-4 w-4" /> },
        ];
      case 'autorizado':
        return [{ acao: 'agendar', rotulo: 'Agendar', icone: <CalendarClock className="h-4 w-4" /> }];
      case 'agendado':
        return [{ acao: 'realizar', rotulo: 'Realizar', icone: <Check className="h-4 w-4" /> }];
      default:
        return [];
    }
  }

  return (
    <div>
      <PageHeader
        title="Regulação de Vagas"
        subtitle="Fila única de encaminhamentos entre unidades — prioridade clínica + ordem de chegada"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {podeSolicitar && (
          <Card className="p-4 xl:col-span-1">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <ArrowLeftRight className="h-4 w-4" /> Solicitar encaminhamento
            </h2>
            <div className="mb-3">
              <PatientPicker selected={paciente} onSelect={setPaciente} />
            </div>
            <form onSubmit={handleSubmit(solicitar)} className="space-y-3">
              <Field label="Especialidade" error={errors.especialidade?.message}>
                <Input placeholder="Cardiologia" {...register('especialidade')} />
              </Field>
              <Field label="Prioridade">
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  {...register('prioridade')}
                >
                  <option value="eletivo">Eletivo</option>
                  <option value="urgencia">Urgência</option>
                  <option value="emergencia">Emergência</option>
                </select>
              </Field>
              <Field label="Justificativa clínica" error={errors.motivo?.message}>
                <textarea
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  rows={3}
                  {...register('motivo')}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="CID-10 (opcional)">
                  <CidPicker
                    value={watch('cid') ?? ''}
                    onChange={(v) => setValue('cid', v)}
                  />
                </Field>
                <Field label="Hipótese diagnóstica">
                  <Input {...register('hipoteseDiagnostica')} />
                </Field>
              </div>
              <Field label="Serviço de destino sugerido">
                <Input placeholder="Hospital de referência" {...register('servicoDestino')} />
              </Field>

              {okMsg && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{okMsg}</p>
              )}

              <Button type="submit" loading={isSubmitting} disabled={!paciente}>
                Incluir na fila
              </Button>
            </form>
          </Card>
        )}

        <Card className={podeSolicitar ? 'overflow-hidden xl:col-span-2' : 'overflow-hidden xl:col-span-3'}>
          {erro && (
            <p className="m-4 mb-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
          )}
          {fila === null && !erro ? (
            <div className="p-4"><TableSkeleton rows={6} /></div>
          ) : !fila || fila.length === 0 ? (
            <EmptyState
              title="Fila de regulação vazia"
              hint="Novas solicitações de encaminhamento aparecem aqui, ordenadas por prioridade clínica."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">Prioridade</th>
                    <th className="px-4 py-2 font-medium">Paciente</th>
                    <th className="px-4 py-2 font-medium">Especialidade</th>
                    <th className="px-4 py-2 font-medium">CID</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Solicitado em</th>
                    {podeRegular && <th className="px-4 py-2 font-medium">Ações do regulador</th>}
                  </tr>
                </thead>
                <tbody>
                  {fila.map((e) => {
                    const pri = PRIORIDADE_BADGE[e.prioridade] ?? PRIORIDADE_BADGE.eletivo;
                    const st = STATUS_BADGE[e.status] ?? STATUS_BADGE.solicitado;
                    return (
                      <tr key={e.id} className="border-b border-slate-100 align-top last:border-0">
                        <td className="px-4 py-2"><Badge tone={pri.tone}>{pri.rotulo}</Badge></td>
                        <td className="px-4 py-2">
                          {e.paciente.nome}
                          {e.paciente.cns && (
                            <p className="text-xs text-slate-400">CNS {e.paciente.cns}</p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {e.especialidade}
                          <p className="max-w-[260px] truncate text-xs text-slate-400" title={e.motivo}>
                            {e.motivo}
                          </p>
                          {e.parecerRegulacao && (
                            <p className="mt-0.5 text-xs text-amber-700">
                              Parecer: {e.parecerRegulacao}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{e.cid ?? '—'}</td>
                        <td className="px-4 py-2">
                          <Badge tone={st.tone}>{st.rotulo}</Badge>
                          {e.dataAgendada && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {new Date(e.dataAgendada).toLocaleString('pt-BR')}
                              {e.unidadeDestino ? ` — ${e.unidadeDestino}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {new Date(e.dataSolicitacao).toLocaleString('pt-BR')}
                        </td>
                        {podeRegular && (
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {acoesDisponiveis(e.status).map((a) => (
                                <Button
                                  key={a.acao}
                                  variant="ghost"
                                  loading={processando === e.id}
                                  onClick={() => agir(e, a.acao)}
                                >
                                  {a.icone} {a.rotulo}
                                </Button>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
