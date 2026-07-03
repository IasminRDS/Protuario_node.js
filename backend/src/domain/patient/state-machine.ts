/**
 * Máquina de estados clínica do paciente — DOMÍNIO PURO.
 * Sem NestJS, sem Prisma: apenas regras. É a fonte única de verdade do fluxo;
 * o frontend nunca altera estado diretamente (só via ações clínicas do backend).
 */
export type PatientStatus =
  | 'REGISTERED'
  | 'IN_TRIAGE'
  | 'WAITING_DOCTOR'
  | 'IN_CONSULTATION'
  | 'UNDER_OBSERVATION'
  | 'DISCHARGED';

/** Grafo de transições válidas. */
export const FSM: Record<PatientStatus, PatientStatus[]> = {
  REGISTERED: ['IN_TRIAGE'],
  IN_TRIAGE: ['WAITING_DOCTOR'],
  WAITING_DOCTOR: ['IN_CONSULTATION'],
  IN_CONSULTATION: ['UNDER_OBSERVATION', 'DISCHARGED'],
  UNDER_OBSERVATION: ['IN_CONSULTATION', 'DISCHARGED'],
  DISCHARGED: [],
};

export const PATIENT_STATUSES = Object.keys(FSM) as PatientStatus[];

export function canTransition(from: PatientStatus, to: PatientStatus): boolean {
  return (FSM[from] ?? []).includes(to);
}

export function isTerminal(status: PatientStatus): boolean {
  return FSM[status].length === 0;
}
