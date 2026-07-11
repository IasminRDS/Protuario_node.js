'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  ShieldAlert,
} from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui/primitives';
import { useAuth } from '@/hooks/useAuth';
import { exportErrorMessage, useExportPacientes, useGerarBackup } from '../hooks/useExport';
import type { ExportFormat } from '../export.service';

export function ExportacaoPage() {
  const { hasRole } = useAuth();
  // O RBAC real é do backend; aqui espelhamos para exibir/ocultar (defense-in-depth):
  // export de PII → Administrador/Recepção; backup global → somente SuperAdmin.
  const canExport = hasRole('Administrador', 'Recepcao');
  const canBackup = hasRole('SuperAdmin');

  return (
    <div>
      <PageHeader
        title="Exportação & Backup"
        subtitle="Saída de dados rastreável — toda exportação é auditada (LGPD)."
      />

      <div className="space-y-4">
        {canExport && <ExportPacientesCard />}
        {canBackup && <BackupCard />}

        {!canExport && !canBackup && (
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              Seu perfil não tem acesso a exportação ou backup.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Exportação é restrita a Administrador/Recepção; backup, ao SuperAdmin.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Exportar pacientes --------------------------- */
function ExportPacientesCard() {
  const exportar = useExportPacientes();
  const [ok, setOk] = useState<ExportFormat | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(format: ExportFormat) {
    setOk(null);
    setErro(null);
    try {
      await exportar.mutateAsync(format);
      setOk(format);
    } catch (e) {
      setErro(exportErrorMessage(e));
    }
  }

  const pendingFmt = exportar.isPending ? exportar.variables : null;

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Download className="h-4 w-4 text-clinic-primary" />
        <h2 className="text-sm font-semibold text-slate-800">Exportar pacientes</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Exporta os pacientes do seu hospital (isolado por tenant). Stream com
        paginação — seguro para grandes volumes. Download inicia automaticamente.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void baixar('csv')}
          loading={pendingFmt === 'csv'}
          disabled={exportar.isPending}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Exportar CSV
        </Button>
        <Button
          variant="secondary"
          onClick={() => void baixar('json')}
          loading={pendingFmt === 'json'}
          disabled={exportar.isPending}
        >
          <FileJson className="h-4 w-4" />
          Exportar JSON
        </Button>
      </div>

      {ok && (
        <Feedback tone="ok">
          Exportação {ok.toUpperCase()} concluída — verifique seus downloads.
        </Feedback>
      )}
      {erro && <Feedback tone="err">{erro}</Feedback>}
    </Card>
  );
}

/* -------------------------------- Backup --------------------------------- */
function BackupCard() {
  const backup = useGerarBackup();
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setOk(false);
    setErro(null);
    try {
      await backup.mutateAsync('sql');
      setOk(true);
    } catch (e) {
      setErro(exportErrorMessage(e));
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Database className="h-4 w-4 text-clinic-primary" />
        <h2 className="text-sm font-semibold text-slate-800">Backup do banco</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          SuperAdmin
        </span>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Backup lógico global (pg_dump) em stream. Operação pesada e restrita —
        pode levar alguns minutos. O arquivo <code>.sql</code> é baixado ao final.
      </p>

      <Button onClick={() => void gerar()} loading={backup.isPending}>
        <Database className="h-4 w-4" />
        {backup.isPending ? 'Gerando backup…' : 'Gerar backup'}
      </Button>

      {backup.isPending && (
        <p className="mt-3 text-xs text-slate-500">
          Processando dump — não feche esta aba até o download iniciar.
        </p>
      )}
      {ok && <Feedback tone="ok">Backup gerado — verifique seus downloads.</Feedback>}
      {erro && <Feedback tone="err">{erro}</Feedback>}
    </Card>
  );
}

/* ------------------------------- Feedback -------------------------------- */
function Feedback({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  const isOk = tone === 'ok';
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
        isOk ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {isOk ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}
