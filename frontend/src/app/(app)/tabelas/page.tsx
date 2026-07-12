'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { terminologiaService } from '@/services/terminologia.service';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, Input, PageHeader, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/utils/cn';

type Tabela = 'cid10' | 'medicamentos' | 'cbo' | 'sigtap' | 'cnes';

const TABS: { valor: Tabela; rotulo: string; hint: string }[] = [
  { valor: 'cid10', rotulo: 'CID-10', hint: 'código ou doença (ex.: A90, dengue)' },
  { valor: 'medicamentos', rotulo: 'Medicamentos (RENAME)', hint: 'nome (ex.: amoxicilina)' },
  { valor: 'cbo', rotulo: 'CBO', hint: 'código ou ocupação (ex.: enfermeiro)' },
  { valor: 'sigtap', rotulo: 'SIGTAP', hint: 'código ou procedimento (ex.: hemograma)' },
  { valor: 'cnes', rotulo: 'CNES', hint: 'CNES, unidade ou município' },
];

interface Coluna {
  chave: string;
  titulo: string;
}
const COLUNAS: Record<Tabela, Coluna[]> = {
  cid10: [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'descricao', titulo: 'Descrição' },
  ],
  medicamentos: [
    { chave: 'nome', titulo: 'Medicamento' },
    { chave: 'apresentacao', titulo: 'Apresentação' },
    { chave: 'via', titulo: 'Via' },
  ],
  cbo: [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'descricao', titulo: 'Ocupação' },
  ],
  sigtap: [
    { chave: 'codigo', titulo: 'Código' },
    { chave: 'descricao', titulo: 'Procedimento' },
  ],
  cnes: [
    { chave: 'cnes', titulo: 'CNES' },
    { chave: 'nome', titulo: 'Estabelecimento' },
    { chave: 'municipio', titulo: 'Município' },
    { chave: 'uf', titulo: 'UF' },
  ],
};

export default function TabelasPage() {
  const [tabela, setTabela] = useState<Tabela>('cid10');
  const [busca, setBusca] = useState('');
  const debounced = useDebounce(busca);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debounced.trim()) {
      setRows([]);
      return;
    }
    setLoading(true);
    const svc = terminologiaService as unknown as Record<
      Tabela,
      (q: string) => Promise<Record<string, unknown>[]>
    >;
    svc[tabela](debounced)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [debounced, tabela]);

  const cols = COLUNAS[tabela];
  const tab = TABS.find((t) => t.valor === tabela)!;

  return (
    <div>
      <PageHeader
        title="Tabelas Oficiais"
        subtitle="Terminologias e cadastros estruturantes do SUS (CID-10, RENAME, CBO, SIGTAP, CNES)"
      />

      <div className="mb-3 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.valor}
            onClick={() => {
              setTabela(t.valor);
              setRows([]);
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tabela === t.valor
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="relative mb-3 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={`Buscar — ${tab.hint}`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {loading ? (
          <Skeleton className="h-40" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            {busca.trim() ? 'Nenhum resultado.' : 'Digite para buscar na tabela oficial.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  {cols.map((c) => (
                    <th key={c.chave} className="px-3 py-2 font-medium">
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    {cols.map((c) => (
                      <td
                        key={c.chave}
                        className={cn(
                          'px-3 py-2',
                          c.chave === 'codigo' || c.chave === 'cnes'
                            ? 'font-mono text-xs text-clinic-primary'
                            : 'text-slate-700',
                        )}
                      >
                        {String(r[c.chave] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          Subconjuntos curados para demonstração. A carga oficial completa
          (DATASUS/RENAME) entra por importação de tabela em produção.
        </p>
      </Card>
    </div>
  );
}
