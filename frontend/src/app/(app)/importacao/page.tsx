'use client';

import { Can } from '@/modules/shared/rbac/Can';
import { Card, EmptyState } from '@/components/ui/primitives';
import { CsvUploadPage } from '@/modules/csv-import/components/CsvUploadPage';

export default function ImportacaoRoute() {
  return (
    <Can
      perm="patient:create"
      fallback={
        <Card>
          <EmptyState
            title="Acesso negado"
            hint="Você não tem permissão para importar pacientes."
          />
        </Card>
      }
    >
      <CsvUploadPage />
    </Can>
  );
}
