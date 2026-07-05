'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button, PageHeader } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/modules/shared/ui/DataTable';
import { StatusBadge } from '@/modules/shared/ui/StatusBadge';
import { Modal } from '@/modules/shared/ui/Modal';
import { Can } from '@/modules/shared/rbac/Can';
import { PacienteForm } from '@/components/clinical/PacienteForm';
import { AuditNotice } from '@/components/clinical/AuditNotice';
import { usePatients } from './usePatients';
import { PatientDrawer } from './PatientDrawer';
import type { PatientView } from './types';

export function PatientsPage() {
  const {
    rows,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    setPage,
    reload,
  } = usePatients();
  const [selected, setSelected] = useState<PatientView | null>(null);
  const [creating, setCreating] = useState(false);
  const [auditedMsg, setAuditedMsg] = useState<string | null>(null);

  const columns: Column<PatientView>[] = [
    {
      key: 'nome',
      header: 'Paciente',
      sortValue: (p) => p.nome,
      render: (p) => <span className="font-medium text-slate-800">{p.nome}</span>,
    },
    {
      key: 'cpf',
      header: 'CPF',
      render: (p) => <span className="text-slate-600">{p.cpf ?? '—'}</span>,
    },
    {
      key: 'nascimento',
      header: 'Nascimento',
      sortValue: (p) => p.dataNascimento,
      render: (p) => new Date(p.dataNascimento).toLocaleDateString('pt-BR'),
    },
    {
      key: 'status',
      header: 'Estado clínico',
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${total} cadastrado(s)`}
        actions={
          <Can perm="patient:create">
            <Button onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4" /> Novo paciente
            </Button>
          </Can>
        }
      />

      {auditedMsg && (
        <div className="mb-3">
          <AuditNotice>{auditedMsg}</AuditNotice>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={reload}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome..."
        onRowClick={setSelected}
        pagination={{ page, totalPages, onPageChange: setPage }}
        emptyLabel="Nenhum paciente encontrado"
      />

      <PatientDrawer patient={selected} onClose={() => setSelected(null)} />

      <Modal open={creating} onClose={() => setCreating(false)} title="Cadastro de paciente">
        <PacienteForm
          onCreated={() => {
            setCreating(false);
            reload();
            setAuditedMsg('Paciente cadastrado — ação registrada em auditoria.');
            setTimeout(() => setAuditedMsg(null), 6000);
          }}
        />
      </Modal>
    </div>
  );
}
