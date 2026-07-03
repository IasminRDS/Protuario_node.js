import type { Permission } from '../rbac/permissions';

/** Estados clínicos formais do paciente (refletem o backend). */
export type PatientStatus =
  | 'REGISTERED'
  | 'IN_TRIAGE'
  | 'WAITING_DOCTOR'
  | 'IN_ATTENDANCE'
  | 'UNDER_OBSERVATION'
  | 'DISCHARGED';

export interface StatusMeta {
  label: string;
  /** token CSS de cor (design system) */
  colorVar: string;
  tone: 'slate' | 'amber' | 'blue' | 'teal' | 'violet' | 'green';
}

export const STATUS_META: Record<PatientStatus, StatusMeta> = {
  REGISTERED: { label: 'Cadastrado', colorVar: 'var(--color-status-registered)', tone: 'slate' },
  IN_TRIAGE: { label: 'Em triagem', colorVar: 'var(--color-status-triage)', tone: 'amber' },
  WAITING_DOCTOR: { label: 'Aguardando médico', colorVar: 'var(--color-status-waiting)', tone: 'blue' },
  IN_ATTENDANCE: { label: 'Em atendimento', colorVar: 'var(--color-status-attendance)', tone: 'teal' },
  UNDER_OBSERVATION: { label: 'Em observação', colorVar: 'var(--color-status-observation)', tone: 'violet' },
  DISCHARGED: { label: 'Alta', colorVar: 'var(--color-status-discharged)', tone: 'green' },
};

interface Transition {
  to: PatientStatus;
  action: string;
  /** permissão necessária para acionar a transição */
  permission: Permission;
}

/**
 * Transições válidas do fluxo hospitalar:
 * REGISTERED → IN_TRIAGE → WAITING_DOCTOR → IN_ATTENDANCE →
 *   (UNDER_OBSERVATION ⇄ IN_ATTENDANCE) → DISCHARGED
 * Transições fora deste grafo são rejeitadas (integridade do fluxo).
 */
const TRANSITIONS: Record<PatientStatus, Transition[]> = {
  REGISTERED: [{ to: 'IN_TRIAGE', action: 'Iniciar triagem', permission: 'triage:write' }],
  IN_TRIAGE: [{ to: 'WAITING_DOCTOR', action: 'Concluir triagem', permission: 'triage:write' }],
  WAITING_DOCTOR: [{ to: 'IN_ATTENDANCE', action: 'Iniciar atendimento', permission: 'clinical:write' }],
  IN_ATTENDANCE: [
    { to: 'UNDER_OBSERVATION', action: 'Colocar em observação', permission: 'clinical:write' },
    { to: 'DISCHARGED', action: 'Dar alta', permission: 'clinical:write' },
  ],
  UNDER_OBSERVATION: [
    { to: 'IN_ATTENDANCE', action: 'Retomar atendimento', permission: 'clinical:write' },
    { to: 'DISCHARGED', action: 'Dar alta', permission: 'clinical:write' },
  ],
  DISCHARGED: [],
};

export function allowedTransitions(status: PatientStatus): Transition[] {
  return TRANSITIONS[status] ?? [];
}

export function canTransition(from: PatientStatus, to: PatientStatus): boolean {
  return allowedTransitions(from).some((t) => t.to === to);
}

export const PATIENT_STATUSES = Object.keys(STATUS_META) as PatientStatus[];
