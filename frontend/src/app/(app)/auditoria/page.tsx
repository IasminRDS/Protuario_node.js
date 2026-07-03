'use client';

import { useCallback, useEffect, useState } from 'react';
import { auditoriaService } from '@/services/auditoria.service';
import { apiErrorMessage } from '@/services/api';
import {
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
