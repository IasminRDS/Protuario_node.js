import type { Paciente } from '@/types';
import type { PatientStatus } from '@/modules/shared/clinical/patient-status';

export type { Paciente };

/**
 * Visão do paciente com estado clínico. O backend /pacientes ainda não retorna
 * `status`; todo paciente cadastrado está, no mínimo, em REGISTERED. As
 * transições reais dependem dos endpoints clínicos (triagem/atendimento).
 */
export interface PatientView extends Paciente {
  status: PatientStatus;
}

export function toPatientView(p: Paciente): PatientView {
  return { ...p, status: 'REGISTERED' };
}
