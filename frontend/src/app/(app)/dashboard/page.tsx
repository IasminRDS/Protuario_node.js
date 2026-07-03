'use client';

import { useEffect, useState } from 'react';
import { Users, Stethoscope, ClipboardList, AlertTriangle } from 'lucide-react';
import { pacientesService } from '@/services/pacientes.service';
import { apiErrorMessage } from '@/services/api';
import { Card, PageHeader, Skeleton, Badge } from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-clinic-primary/10 p-2 text-clinic-primary">
          <Icon className="h-5 w-5" />
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
  const [totalPacientes, setTotalPacientes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pacientesService
      .list({ page: 1, pageSize: 1 })
      .then((r) => setTotalPacientes(r.meta.total))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title={`Bem-vindo, ${user?.login ?? ''}`}
        subtitle="Visão operacional do dia"
      />

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
            hint="Total no sistema"
          />
        )}

        <Kpi icon={ClipboardList} label="Fila de triagem" value="—" hint="módulo pendente" />
        <Kpi icon={Stethoscope} label="Atendimentos ativos" value="—" hint="módulo pendente" />
        <Kpi icon={AlertTriangle} label="Alertas clínicos" value="—" hint="módulo pendente" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Fila de triagem</h2>
            <Badge tone="amber">aguardando backend</Badge>
          </div>
          <p className="text-sm text-slate-500">
            O endpoint <code>/triagem</code> ainda não está disponível no backend.
            A tela de Triagem já envia os dados assim que a rota for exposta.
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Atendimentos em andamento</h2>
            <Badge tone="amber">aguardando backend</Badge>
          </div>
          <p className="text-sm text-slate-500">
            O endpoint <code>/atendimentos</code> ainda não está disponível.
          </p>
        </Card>
      </div>
    </div>
  );
}
