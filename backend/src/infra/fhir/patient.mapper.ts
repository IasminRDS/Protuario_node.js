import { Paciente } from '@prisma/client';

export type FhirResource = Record<string, unknown>;

const CPF_SYSTEM = 'urn:oid:2.16.840.1.113883.13.237'; // CPF (Brasil)
const CNS_SYSTEM = 'https://fhir.saude.gov.br/sid/cns';

function gender(sexo: string): string {
  return { M: 'male', F: 'female', O: 'other' }[sexo] ?? 'unknown';
}

/** Paciente (interno) → FHIR R4 Patient. */
export function toFhirPatient(p: Paciente): FhirResource {
  const identifier: FhirResource[] = [];
  if (p.cpf) identifier.push({ system: CPF_SYSTEM, value: p.cpf });
  if (p.cns) identifier.push({ system: CNS_SYSTEM, value: p.cns });

  const telecom: FhirResource[] = [];
  if (p.telefone) telecom.push({ system: 'phone', value: p.telefone });
  if (p.email) telecom.push({ system: 'email', value: p.email });

  return {
    resourceType: 'Patient',
    id: p.id.toString(),
    active: p.deletedAt === null,
    identifier,
    name: [{ text: p.nome }],
    gender: gender(p.sexo),
    birthDate: p.dataNascimento.toISOString().slice(0, 10),
    telecom,
  };
}
