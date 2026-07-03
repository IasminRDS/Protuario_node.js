import { Atendimento } from '@prisma/client';
import { FhirResource } from './patient.mapper';

function status(s: string): string {
  return (
    {
      ACTIVE: 'in-progress',
      PAUSED: 'onhold',
      FINISHED: 'finished',
      CANCELLED: 'cancelled',
    }[s] ?? 'unknown'
  );
}

/** Atendimento (interno) → FHIR R4 Encounter. */
export function toFhirEncounter(a: Atendimento): FhirResource {
  return {
    resourceType: 'Encounter',
    id: a.id.toString(),
    status: status(a.status),
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: `Patient/${a.pacienteId.toString()}` },
    participant: [
      {
        individual: { reference: `Practitioner/${a.medicoId.toString()}` },
      },
    ],
    period: {
      start: a.data.toISOString(),
      ...(a.finishedAt ? { end: a.finishedAt.toISOString() } : {}),
    },
  };
}
