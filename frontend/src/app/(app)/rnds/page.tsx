'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, RefreshCw, Send } from 'lucide-react';
import {
  rndsService,
  type EnvioRnds,
  type TipoEnvioRnds,
} from '@/services/rnds.service';
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

const TIPO_LABEL: Record<TipoEnvioRnds, string> = {
  RAC: 'RAC — Registro de Atendimento Clínico',
  RIA: 'RIA — Registro de Imunização',
  RESULTADO_EXAME: 'Resultado de exame',
};

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  ENVIADO: 'green',
  PENDENTE: 'amber',
  ERRO: 'red',
};

export default function RndsPage() {
  const [envios, setEnvios] = useState<EnvioRnds[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoEnvioRnds>('RIA');
  const [entityId, setEntityId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [processando, setProcessando] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setEnvios(await rndsService.listar());
    } catch (e) {
      setErro(apiErrorMessage(e, 'Falha ao carregar os envios.'));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId.trim()) return;
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      const r = await rndsService.enviar(tipo, entityId.trim());
      setOk(`Enviado — protocolo ${r.protocolo ?? '—'}.`);
      setEntityId('');
      await carregar();
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao enviar à RNDS.'));
    } finally {
      setEnviando(false);
    }
  }

  async function reenviar(id: string) {
    setProcessando(id);
    try {
      await rndsService.reenviar(id);
      await carregar();
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha no reenvio.'));
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Integrações RNDS"
        subtitle="Envio de registros clínicos (FHIR) à Rede Nacional de Dados em Saúde"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-1">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Send className="h-4 w-4" /> Enviar registro
          </h2>
          <form onSubmit={enviar} className="space-y-3">
            <Field label="Tipo de registro">
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoEnvioRnds)}
              >
                <option value="RIA">RIA — Imunização (id da vacina aplicada)</option>
                <option value="RESULTADO_EXAME">Resultado de exame (id do exame)</option>
                <option value="RAC">RAC — Atendimento (id do atendimento)</option>
              </select>
            </Field>
            <Field label="ID do registro de origem">
              <Input
                placeholder="ex.: 12"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              />
            </Field>
            {ok && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{ok}</p>
            )}
            <Button type="submit" loading={enviando} disabled={!entityId.trim()}>
              <Network className="h-4 w-4" /> Construir bundle e enviar
            </Button>
            <p className="text-[11px] text-slate-400">
              O bundle FHIR é montado a partir do registro e despachado à RNDS.
              Sem credenciamento, opera em modo simulado (protocolo local).
            </p>
          </form>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          {erro && (
            <p className="m-4 mb-0 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
          )}
          {envios === null && !erro ? (
            <div className="p-4"><TableSkeleton rows={6} /></div>
          ) : !envios || envios.length === 0 ? (
            <EmptyState
              title="Nenhum envio à RNDS ainda"
              hint="Envie um registro pelo formulário ao lado para acompanhar o status aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 font-medium">Recurso FHIR</th>
                    <th className="px-4 py-2 font-medium">Paciente</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Protocolo</th>
                    <th className="px-4 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2" title={TIPO_LABEL[e.tipo]}>{e.tipo}</td>
                      <td className="px-4 py-2 font-mono text-xs">{e.recursoTipo}</td>
                      <td className="px-4 py-2">
                        {e.pacienteNome ?? `#${e.pacienteId ?? '—'}`}
                      </td>
                      <td className="px-4 py-2">
                        <Badge tone={STATUS_TONE[e.status] ?? 'slate'}>{e.status}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{e.protocolo ?? '—'}</td>
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          loading={processando === e.id}
                          onClick={() => reenviar(e.id)}
                        >
                          <RefreshCw className="h-4 w-4" /> Reenviar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
