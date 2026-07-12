'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  auditoriaService,
  type VerificacaoCadeia,
} from '@/services/auditoria.service';
import { apiErrorMessage } from '@/services/api';
import {
  Button,
  Card,
  Input,
  PageHeader,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Badge,
} from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';
import type { Auditoria } from '@/types';

export default function AuditoriaPage() {
  const { hasRole } = useAuth();
  const [modulo, setModulo] = useState('');
  const [items, setItems] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cadeia, setCadeia] = useState<VerificacaoCadeia | null>(null);
  const [verificando, setVerificando] = useState(false);

  async function verificarCadeia() {
    setVerificando(true);
    try {
      await auditoriaService.selar(); // sela pendentes antes de verificar
      setCadeia(await auditoriaService.verify());
    } catch (e) {
      setError(apiErrorMessage(e, 'Falha ao verificar a cadeia.'));
    } finally {
      setVerificando(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await auditoriaService.list({
        page: 1,
        pageSize: 30,
        modulo: modulo || undefined,
      });
      setItems(r.items);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [modulo]);

  useEffect(() => {
    load();
  }, [load]);

  if (!hasRole('Administrador', 'Gestor')) {
    return (
      <Card className="p-8">
        <EmptyState title="Acesso restrito" hint="Somente Administrador/Gestor." />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Auditoria"
        subtitle="Rastreabilidade de ações (LGPD) — registros imutáveis"
      />

      {/* Verificação de integridade da cadeia de hash (ADR-06). */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <ShieldCheck className="h-4 w-4" /> Integridade criptográfica
            </h2>
            <p className="text-xs text-slate-500">
              Cada evento é encadeado por hash SHA-256. A verificação recomputa a
              cadeia e detecta qualquer adulteração.
            </p>
          </div>
          <Button onClick={verificarCadeia} loading={verificando}>
            Verificar integridade
          </Button>
        </div>
        {cadeia && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              cadeia.integra
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {cadeia.integra ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            {cadeia.integra
              ? `Cadeia íntegra — ${cadeia.verificados} evento(s) verificado(s).`
              : `Cadeia quebrada a partir do evento #${cadeia.quebradoNoId}.`}
          </div>
        )}
      </Card>

      <Card>
        <div className="border-b border-slate-200 p-3">
          <Input
            className="max-w-xs"
            placeholder="Filtrar por módulo (ex.: PACIENTES, AUTH)"
            value={modulo}
            onChange={(e) => setModulo(e.target.value.toUpperCase())}
          />
        </div>

        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState title="Sem eventos de auditoria" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">Módulo</th>
                <th className="px-4 py-2 font-medium">Operação</th>
                <th className="px-4 py-2 font-medium">Objeto</th>
                <th className="px-4 py-2 font-medium">Usuário</th>
                <th className="px-4 py-2 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(a.dataEvento).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone="blue">{a.modulo}</Badge>
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-700">{a.operacao}</td>
                  <td className="px-4 py-2 text-slate-500">{a.objeto ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{a.usuarioId ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge tone={a.resultado === 'SUCESSO' ? 'green' : 'slate'}>
                      {a.resultado ?? '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
