'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { PageHeader, Card, Button } from '@/components/ui/primitives';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import type { Paciente } from '@/types';

export default function ProntuarioPage() {
  const router = useRouter();
  const [paciente, setPaciente] = useState<Paciente | null>(null);

  return (
    <div>
      <PageHeader
        title="Prontuário Eletrônico"
        subtitle="Selecione o paciente para abrir o histórico clínico"
      />
      <Card className="max-w-xl p-5">
        <PatientPicker selected={paciente} onSelect={setPaciente} />
        <Button
          className="mt-4"
          disabled={!paciente}
          onClick={() => paciente && router.push(`/pacientes/${paciente.id}`)}
        >
          <FileText className="h-4 w-4" /> Abrir prontuário
        </Button>
      </Card>
    </div>
  );
}
