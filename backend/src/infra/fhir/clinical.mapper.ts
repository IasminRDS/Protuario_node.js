import { Prescricao, Triagem } from '@prisma/client';
import { FhirResource } from './patient.mapper';

/** Prescrição (interna) → FHIR R4 MedicationRequest. */
export function toFhirMedicationRequest(p: Prescricao): FhirResource {
  const dosageText = [p.dosagem, p.frequencia, p.duracao]
    .filter(Boolean)
    .join(' · ');
  return {
    resourceType: 'MedicationRequest',
    id: p.id.toString(),
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: { text: p.medicamento },
    encounter: { reference: `Encounter/${p.atendimentoId.toString()}` },
    ...(dosageText
      ? { dosageInstruction: [{ text: dosageText }] }
      : {}),
    ...(p.observacoes ? { note: [{ text: p.observacoes }] } : {}),
  };
}

/** Triagem (sinais vitais) → FHIR R4 Observation (vital-signs, com components). */
export function toFhirObservation(t: Triagem): FhirResource {
  const components: FhirResource[] = [];
  if (t.pressao)
    components.push({ code: { text: 'Pressão arterial' }, valueString: t.pressao });
  if (t.frequencia != null)
    components.push({
      code: { text: 'Frequência cardíaca' },
      valueQuantity: { value: t.frequencia, unit: 'bpm' },
    });
  if (t.temperatura != null)
    components.push({
      code: { text: 'Temperatura' },
      valueQuantity: { value: Number(t.temperatura), unit: 'Cel' },
    });
  if (t.saturacao != null)
    components.push({
      code: { text: 'Saturação O2' },
      valueQuantity: { value: Number(t.saturacao), unit: '%' },
    });

  return {
    resourceType: 'Observation',
    id: t.id.toString(),
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
          },
        ],
      },
    ],
    code: { text: 'Sinais vitais (triagem)' },
    subject: { reference: `Patient/${t.pacienteId.toString()}` },
    effectiveDateTime: t.createdAt.toISOString(),
    component: components,
  };
}
