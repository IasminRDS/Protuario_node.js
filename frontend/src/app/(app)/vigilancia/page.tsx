'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, Trash2 } from 'lucide-react';
import {
  vigilanciaService,
  type NotificacaoCompulsoria,
  type StatusNotificacao,
} from '@/services/vigilancia.service';
import { apiErrorMessage } from '@/services/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  TableSkeleton,
} from '@/components/ui/primitives';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import { cn } from '@/utils/cn';

const ABAS: { valor: StatusNotificacao; rotulo: string }[] = [
  { valor: 'PENDENTE', rotulo: 'Pendentes' },
  { valor: 'ENVIADA', rotulo: 'Enviadas' },
  { valor: 'DESCARTADA', rotulo: 'Descartadas' },
];

const ORIGEM_LABEL: Record<string, string> = {
  INTERNACAO: 'Internação',
  ALTA: 'Alta hospitalar',
  REGULACAO: 'Regulação',
  MANUAL: 'Manual',
};

export default function VigilanciaPage() {
  const { can } = usePermissions();
  const podeResolver = can('surveillance:write');

  const [aba, setAba] = useState<StatusNotificacao>('PENDENTE');
  const [itens, setItens] = useState<NotificacaoCompulsoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async (status: StatusNotificacao) => {
    setItens(null);
    setErro(null);
    try {
      setItens(await vigilanciaService.listar(status));
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao carregar notificações.'));
    }
  }, []);

  useEffect(() => {
    void carregar(aba);
  }, [aba, carregar]);

  async function resolver(item: NotificacaoCompulsoria, acao: 'ENVIAR' | 'DESCARTAR') {
    let motivo: string | undefined;
    if (acao === 'DESCARTAR') {
      motivo = window.prompt('Motivo do descarte (obrigatório):')?.trim() || undefined;
      if (!motivo) return;
    }
    setProcessando(item.id);
    setErro(null);
    try {
      await vigilanciaService.resolver(item.id, acao, motivo);
      await carregar(aba);
    } catch (err) {
      setErro(apiErrorMessage(err, 'Falha ao resolver notificação.'));
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vigilância Epidemiológica"
        subtitle="Notificação compulsória (SINAN) — fichas geradas automaticamente por CID notificável"
      />

      <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            onClick={() => setAba(a.valor)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              aba === a.valor
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
      )}

      <Card className="overflow-hidden">
        {itens === null && !erro ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : !itens || itens.length === 0 ? (
          <EmptyState
            title="Nenhuma notificação nesta situação"
            hint="Fichas são abertas automaticamente quando um CID de agravo notificável é registrado em internação, alta ou regulação."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Agravo</th>
                  <th className="px-4 py-2 font-medium">CID</th>
                  <th className="px-4 py-2 font-medium">Paciente</th>
                  <th className="px-4 py-2 font-medium">Município</th>
                  <th className="px-4 py-2 font-medium">Origem</th>
                  <th className="px-4 py-2 font-medium">Prazo</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                  {aba === 'PENDENTE' && podeResolver && (
                    <th className="px-4 py-2 font-medium">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {itens.map((n) => (
                  <tr key={n.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">
                      <span className="flex items-center gap-1.5">
                        {n.imediata && (
                          <AlertTriangle
                            className="h-4 w-4 shrink-0 text-red-500"
                            aria-label="Notificação imediata"
                          />
                        )}
                        {n.agravo}
                      </span>
                      {n.motivoDescarte && (
                        <p className="mt-0.5 text-xs font-normal text-slate-400">
                          Descarte: {n.motivoDescarte}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{n.cid}</td>
                    <td className="px-4 py-2">
                      {n.paciente.nome}
                      {n.paciente.cns && (
                        <p className="text-xs text-slate-400">CNS {n.paciente.cns}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {n.paciente.municipio ?? '—'}
                      {n.paciente.uf ? `/${n.paciente.uf}` : ''}
                    </td>
                    <td className="px-4 py-2 text-xs">{ORIGEM_LABEL[n.origem] ?? n.origem}</td>
                    <td className="px-4 py-2">
                      {n.imediata ? (
                        <Badge tone="red">Imediata (24h)</Badge>
                      ) : (
                        <Badge tone="slate">Semanal</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(n.createdAt).toLocaleString('pt-BR')}
                    </td>
                    {aba === 'PENDENTE' && podeResolver && (
                      <td className="px-4 py-2">
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            className="text-emerald-700"
                            loading={processando === n.id}
                            onClick={() => resolver(n, 'ENVIAR')}
                            title="Enviar à vigilância"
                          >
                            <Send className="h-4 w-4" /> Enviar
                          </Button>
                          <Button
                            variant="ghost"
                            className="text-red-600"
                            loading={processando === n.id}
                            onClick={() => resolver(n, 'DESCARTAR')}
                            title="Descartar (falso positivo)"
                          >
                            <Trash2 className="h-4 w-4" /> Descartar
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {aba !== 'PENDENTE' && itens && itens.length > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Toda resolução fica registrada em auditoria
          (quem, quando e por quê).
        </p>
      )}
    </div>
  );
}
