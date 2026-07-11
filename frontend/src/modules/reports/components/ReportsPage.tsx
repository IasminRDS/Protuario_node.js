'use client';

import { useMemo, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import {
  Button,
  ErrorState,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import { auditRelatorioExport } from '@/modules/export/export.service';
import {
  reportsErrorMessage,
  useAtendimentosPorDia,
  useExames,
  useRefreshReports,
} from '../hooks/useReports';
import { downloadCsv, toCsv } from '../lib/csv';
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

  // Export CSV client-side + registro na trilha LGPD (RELATORIO/EXPORTAR).
  function exportAtendimentos() {
    const rows = atendimentosFiltrados;
    if (rows.length === 0) return;
    downloadCsv(
      toCsv(rows, [
        { key: 'dia', label: 'Dia' },
        { key: 'totalAtendimentos', label: 'Total de atendimentos' },
      ]),
      'atendimentos-por-dia',
    );
    void auditRelatorioExport({
      relatorio: 'atendimentos-por-dia',
      totalRegistros: rows.length,
    });
  }

  function exportExames() {
    const rows = exames.data ?? [];
    if (rows.length === 0) return;
    downloadCsv(
      toCsv(rows, [
        { key: 'codigo', label: 'Código' },
        { key: 'tipoExame', label: 'Tipo de exame' },
        { key: 'total', label: 'Total' },
      ]),
      'exames-realizados',
    );
    void auditRelatorioExport({
      relatorio: 'exames-realizados',
      totalRegistros: rows.length,
    });
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores operacionais do hospital"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={exportAtendimentos}
              disabled={atendimentosFiltrados.length === 0}
            >
              <Download className="h-4 w-4" />
              CSV atendimentos
            </Button>
            <Button
              variant="secondary"
              onClick={exportExames}
              disabled={(exames.data ?? []).length === 0}
            >
              <Download className="h-4 w-4" />
              CSV exames
            </Button>
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
              Atualizar dados
            </Button>
          </div>
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
