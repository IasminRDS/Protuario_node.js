'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  BedDouble,
  ChevronRight,
  Siren,
  Users,
  Activity,
} from 'lucide-react';
import { pacientesService } from '@/services/pacientes.service';
import {
  epidemiologiaService,
  type ResumoEpidemiologico,
} from '@/services/epidemiologia.service';
import { apiErrorMessage } from '@/services/api';
import { Card, PageHeader, Skeleton } from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import { useVisibleNavGroups } from '@/modules/shared/rbac/useNav';

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  alerta,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  alerta?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`rounded-md p-2 ${
            alerta ? 'bg-red-50 text-red-600' : 'bg-clinic-primary/10 text-clinic-primary'
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-800">{value}</p>
          {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const grupos = useVisibleNavGroups().filter((g) => g.titulo !== null);

  const [totalPacientes, setTotalPacientes] = useState<number | null>(null);
  const [resumo, setResumo] = useState<ResumoEpidemiologico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const podeVerResumo = can('reports:read');

  useEffect(() => {
    pacientesService
      .list({ page: 1, pageSize: 1 })
      .then((r) => setTotalPacientes(r.meta.total))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));

    if (podeVerResumo) {
      epidemiologiaService
        .resumo()
        .then(setResumo)
        .catch(() => setResumo(null)); // sem permissão/indisponível: só oculta
    }
  }, [podeVerResumo]);

  return (
    <div>
      <PageHeader
        title={`Bem-vindo, ${user?.login ?? ''}`}
        subtitle="Visão operacional do dia"
      />

      {/* KPIs com dados reais (o resumo só aparece p/ quem tem reports:read) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <Skeleton className="h-[86px]" />
        ) : error ? (
          <Card className="p-4">
            <p className="text-xs text-red-600">{error}</p>
          </Card>
        ) : (
          <Kpi
            icon={Users}
            label="Pacientes cadastrados"
            value={String(totalPacientes ?? 0)}
            hint="Total no hospital"
          />
        )}

        {resumo && (
          <>
            <Kpi
              icon={Activity}
              label="Triagens (24h)"
              value={String(resumo.triagens24h)}
              hint={`${resumo.internacoesAtivas} internação(ões) ativa(s)`}
            />
            <Kpi
              icon={BedDouble}
              label="Ocupação de leitos"
              value={`${resumo.leitos.taxaOcupacao}%`}
              hint={`${resumo.leitos.ocupados}/${resumo.leitos.total} ocupados`}
              alerta={resumo.leitos.taxaOcupacao >= 85}
            />
            <Kpi
              icon={Siren}
              label="Notificações pendentes"
              value={String(resumo.notificacoes.pendentes)}
              hint={
                resumo.notificacoes.imediatas > 0
                  ? `${resumo.notificacoes.imediatas} imediata(s) — prazo 24h`
                  : `${resumo.regulacao.filaAberta} na fila de regulação`
              }
              alerta={resumo.notificacoes.imediatas > 0}
            />
          </>
        )}
      </div>

      {/* Categorias e funcionalidades (RBAC: cada um vê só o que pode usar) */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-700">
        Categorias e funcionalidades
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {grupos.map((grupo) => (
          <Card key={grupo.titulo} className="p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-clinic-primary">
              {grupo.titulo}
            </h3>
            <ul className="divide-y divide-slate-100">
              {grupo.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3 py-2.5"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors group-hover:bg-clinic-primary/10 group-hover:text-clinic-primary">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-clinic-primary">
                          {item.label}
                        </span>
                        {item.descricao && (
                          <span className="block truncate text-xs text-slate-400">
                            {item.descricao}
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-clinic-primary"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {resumo && resumo.regulacao.filaAberta > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
          Há {resumo.regulacao.filaAberta} encaminhamento(s) aguardando na{' '}
          <Link href="/regulacao" className="font-medium text-clinic-primary hover:underline">
            fila de regulação
          </Link>
          .
        </p>
      )}
    </div>
  );
}
