'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, ArrowLeftRight, BedDouble, Siren } from 'lucide-react';
import {
  epidemiologiaService,
  type AgravoCount,
  type FilaRegulacaoAgg,
  type ManchesterCount,
  type MunicipioCount,
  type OcupacaoSetor,
  type ResumoEpidemiologico,
} from '@/services/epidemiologia.service';
import { apiErrorMessage } from '@/services/api';
import { MANCHESTER, nivelManchester } from '@/modules/shared/clinical/manchester';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';

const PRIORIDADE_COR: Record<string, string> = {
  emergencia: '#dc2626',
  urgencia: '#f59e0b',
  eletivo: '#3b82f6',
};

function StatCard({
  titulo,
  valor,
  detalhe,
  icone,
  alerta,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: string;
  icone: React.ReactNode;
  alerta?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          alerta ? 'bg-red-50 text-red-600' : 'bg-clinic-primary/10 text-clinic-primary'
        }`}
      >
        {icone}
      </div>
      <div>
        <p className="text-xs text-slate-500">{titulo}</p>
        <p className="text-xl font-bold text-slate-800">{valor}</p>
        {detalhe && <p className="text-[11px] text-slate-400">{detalhe}</p>}
      </div>
    </Card>
  );
}

function ChartCard({
  titulo,
  loading,
  vazio,
  children,
}: {
  titulo: string;
  loading: boolean;
  vazio: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{titulo}</h2>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : vazio ? (
        <EmptyState title="Sem dados no período" />
      ) : (
        children
      )}
    </Card>
  );
}

export default function EpidemiologiaPage() {
  const [resumo, setResumo] = useState<ResumoEpidemiologico | null>(null);
  const [agravos, setAgravos] = useState<AgravoCount[] | null>(null);
  const [municipios, setMunicipios] = useState<MunicipioCount[] | null>(null);
  const [leitos, setLeitos] = useState<OcupacaoSetor[] | null>(null);
  const [regulacao, setRegulacao] = useState<FilaRegulacaoAgg | null>(null);
  const [manchester, setManchester] = useState<ManchesterCount[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, a, m, l, f, t] = await Promise.all([
          epidemiologiaService.resumo(),
          epidemiologiaService.porAgravo(30),
          epidemiologiaService.porMunicipio(30),
          epidemiologiaService.ocupacaoLeitos(),
          epidemiologiaService.filaRegulacao(),
          epidemiologiaService.manchester(7),
        ]);
        setResumo(r);
        setAgravos(a);
        setMunicipios(m);
        setLeitos(l);
        setRegulacao(f);
        setManchester(t);
      } catch (err) {
        setErro(apiErrorMessage(err, 'Falha ao carregar o painel.'));
      }
    })();
  }, []);

  const manchesterSerie = (manchester ?? [])
    .map((m) => ({
      ...m,
      nivel: nivelManchester(m.classificacao),
    }))
    .filter((m) => m.nivel)
    .sort(
      (a, b) =>
        MANCHESTER.findIndex((n) => n.valor === a.nivel!.valor) -
        MANCHESTER.findIndex((n) => n.valor === b.nivel!.valor),
    );

  return (
    <div>
      <PageHeader
        title="Painel Epidemiológico"
        subtitle="Vigilância, leitos, regulação e classificação de risco — visão regional"
      />

      {erro && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          titulo="Notificações pendentes"
          valor={resumo?.notificacoes.pendentes ?? '—'}
          detalhe={
            resumo ? `${resumo.notificacoes.imediatas} imediata(s) (≤24h)` : undefined
          }
          icone={<Siren className="h-5 w-5" />}
          alerta={(resumo?.notificacoes.imediatas ?? 0) > 0}
        />
        <StatCard
          titulo="Ocupação de leitos"
          valor={resumo ? `${resumo.leitos.taxaOcupacao}%` : '—'}
          detalhe={resumo ? `${resumo.leitos.ocupados}/${resumo.leitos.total} ocupados` : undefined}
          icone={<BedDouble className="h-5 w-5" />}
          alerta={(resumo?.leitos.taxaOcupacao ?? 0) >= 85}
        />
        <StatCard
          titulo="Fila de regulação"
          valor={resumo?.regulacao.filaAberta ?? '—'}
          detalhe="encaminhamentos abertos"
          icone={<ArrowLeftRight className="h-5 w-5" />}
        />
        <StatCard
          titulo="Triagens (24h)"
          valor={resumo?.triagens24h ?? '—'}
          icone={<Activity className="h-5 w-5" />}
        />
        <StatCard
          titulo="Internações ativas"
          valor={resumo?.internacoesAtivas ?? '—'}
          icone={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          titulo="Notificações compulsórias por agravo (30 dias)"
          loading={agravos === null && !erro}
          vazio={!agravos || agravos.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={agravos ?? []}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                type="category"
                dataKey="agravo"
                width={140}
                tick={{ fontSize: 10, fill: '#334155' }}
              />
              <Tooltip formatter={(v) => [v as number, 'Notificações']} />
              <Bar dataKey="total" fill="#0f766e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          titulo="Notificações por município de residência (30 dias)"
          loading={municipios === null && !erro}
          vazio={!municipios || municipios.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={(municipios ?? []).map((m) => ({
                ...m,
                nome: `${m.municipio}${m.uf !== '—' ? `/${m.uf}` : ''}`,
              }))}
              margin={{ top: 4, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 10, fill: '#334155' }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => [v as number, 'Notificações']} />
              <Bar dataKey="total" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          titulo="Ocupação de leitos por setor"
          loading={leitos === null && !erro}
          vazio={!leitos || leitos.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={leitos ?? []} margin={{ top: 4, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="setor" tick={{ fontSize: 11, fill: '#334155' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ocupados" name="Ocupados" stackId="a" fill="#dc2626" />
              <Bar dataKey="reservados" name="Reservados" stackId="a" fill="#f59e0b" />
              <Bar dataKey="higienizacao" name="Higienização" stackId="a" fill="#94a3b8" />
              <Bar dataKey="livres" name="Livres" stackId="a" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          titulo="Classificação de risco — Manchester (7 dias)"
          loading={manchester === null && !erro}
          vazio={manchesterSerie.length === 0}
        >
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={manchesterSerie}
                dataKey="total"
                nameKey="classificacao"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                label={({ name, value }: { name?: string; value?: number }) =>
                  `${name} (${value})`
                }
              >
                {manchesterSerie.map((m) => (
                  <Cell key={m.classificacao} fill={m.nivel!.hex} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, nome) => [
                  v as number,
                  nivelManchester(String(nome))?.rotulo ?? String(nome),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          titulo="Fila de regulação por prioridade"
          loading={regulacao === null && !erro}
          vazio={!regulacao || regulacao.porPrioridade.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={regulacao?.porPrioridade ?? []}
              margin={{ top: 4, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="prioridade" tick={{ fontSize: 11, fill: '#334155' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => [v as number, 'Encaminhamentos']} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {(regulacao?.porPrioridade ?? []).map((p) => (
                  <Cell key={p.prioridade} fill={PRIORIDADE_COR[p.prioridade] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          titulo="Encaminhamentos por status"
          loading={regulacao === null && !erro}
          vazio={!regulacao || regulacao.porStatus.length === 0}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={regulacao?.porStatus ?? []}
              margin={{ top: 4, right: 16, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#334155' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => [v as number, 'Encaminhamentos']} />
              <Bar dataKey="total" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
