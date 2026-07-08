'use client';

import { Can } from '@/modules/shared/rbac/Can';
import { Card, EmptyState } from '@/components/ui/primitives';
import { ReportsPage } from '@/modules/reports/components/ReportsPage';

export default function RelatoriosRoute() {
  return (
    <Can
      perm="reports:read"
      fallback={
        <Card>
          <EmptyState
            title="Acesso negado"
            hint="Você não tem permissão para visualizar relatórios."
          />
        </Card>
      }
    >
      <ReportsPage />
    </Can>
  );
}
