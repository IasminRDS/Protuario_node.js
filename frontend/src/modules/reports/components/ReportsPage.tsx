'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Button,
  ErrorState,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import {
  reportsErrorMessage,
  useAtendimentosPorDia,
  useExames,
  useRefreshReports,
} from '../hooks/useReports';
import { CardsResumo } from './CardsResumo';
import { AtendimentosChart } from './AtendimentosChart';
import { ExamesChart } from './ExamesChart';

export function ReportsPage() {
  const atendimentos = useAtendimentosPorDia();
  const exames = useExames();
  const refresh = useRefreshReports();

  // Filtro de período: aplicado LOCALMENTE (backend ainda não filtra por data).
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const atendimentosFiltrados = useMemo(() => {
    const rows = atendimentos.data ?? [];
    return rows.filter((r) => (!de || r.dia >= de) && (!ate || r.dia <= ate));
  }, [atendimentos.data, de, ate]);

  const erro = atendimentos.isError
    ? atendimentos.error
    : exames.isError
      ? exames.error
      : null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores operacionais do hospital"
        actions={
          <Button variant="secondary" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Atualizar dados
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="De">
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Field>
        <Field label="Até">
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Field>
        {(de || ate) && (
          <Button
            variant="ghost"
            onClick={() => {
              setDe('');
              setAte('');
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      {erro && (
        <div className="mb-4">
          <ErrorState
            message={reportsErrorMessage(erro)}
            onRetry={() => {
              void atendimentos.refetch();
              void exames.refetch();
            }}
          />
        </div>
      )}

      <div className="space-y-4">
        <CardsResumo />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AtendimentosChart
            data={atendimentosFiltrados}
            isLoading={atendimentos.isLoading}
          />
          <ExamesChart data={exames.data ?? []} isLoading={exames.isLoading} />
        </div>
      </div>
    </div>
  );
}
