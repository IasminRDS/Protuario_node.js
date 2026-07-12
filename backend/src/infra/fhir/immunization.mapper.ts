import { VacinaAplicada } from '@prisma/client';
import { FhirResource } from './patient.mapper';

/**
 * VacinaAplicada (interno) → FHIR R4 Immunization (base do perfil RNDS de
 * Registro de Imunização — RIA). `vaccineCode` usa a denominação; em produção,
 * mapear para o código PNI/SIPNI.
 */
export function toFhirImmunization(
  v: VacinaAplicada & { vacina?: { nome: string | null } | null },
): FhirResource {
  return {
    resourceType: 'Immunization',
    id: v.id.toString(),
    status: 'completed',
    vaccineCode: {
      text: v.vacina?.nome ?? v.nomeVacina ?? 'Imunobiológico',
    },
    patient: { reference: `Patient/${v.pacienteId.toString()}` },
    occurrenceDateTime: v.dataAplicacao.toISOString(),
    doseQuantity: v.dose ? { value: v.dose } : undefined,
    location: v.unidade ? { display: v.unidade } : undefined,
    performer: v.profissional
      ? [{ actor: { display: v.profissional } }]
      : undefined,
  };
}
