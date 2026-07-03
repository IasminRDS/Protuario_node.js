import { Permission } from '../../shared/rbac/permissions';
import { PatientStatus, FSM } from './state-machine';

/** Ação clínica que dispara cada transição + permissão exigida. */
export interface TransitionSpec {
  from: PatientStatus;
  to: PatientStatus;
  action: string;
  permission: Permission;
}

export const TRANSITIONS: TransitionSpec[] = [
  { from: 'REGISTERED', to: 'IN_TRIAGE', action: 'Iniciar triagem', permission: Permission.TRIAGE_WRITE },
  { from: 'IN_TRIAGE', to: 'WAITING_DOCTOR', action: 'Concluir triagem', permission: Permission.TRIAGE_WRITE },
  { from: 'WAITING_DOCTOR', to: 'IN_CONSULTATION', action: 'Iniciar atendimento', permission: Permission.ENCOUNTER_WRITE },
  { from: 'IN_CONSULTATION', to: 'UNDER_OBSERVATION', action: 'Colocar em observação', permission: Permission.ENCOUNTER_WRITE },
  { from: 'IN_CONSULTATION', to: 'DISCHARGED', action: 'Dar alta', permission: Permission.ENCOUNTER_WRITE },
  { from: 'UNDER_OBSERVATION', to: 'IN_CONSULTATION', action: 'Retomar atendimento', permission: Permission.ENCOUNTER_WRITE },
  { from: 'UNDER_OBSERVATION', to: 'DISCHARGED', action: 'Dar alta', permission: Permission.ENCOUNTER_WRITE },
];

export function transitionsFrom(status: PatientStatus): TransitionSpec[] {
  return TRANSITIONS.filter((t) => t.from === status);
}

export function permissionFor(
  from: PatientStatus,
  to: PatientStatus,
): Permission | null {
  return TRANSITIONS.find((t) => t.from === from && t.to === to)?.permission ?? null;
}

// Sanidade: toda aresta do FSM tem uma spec de transição correspondente.
export function assertConsistent(): void {
  for (const from of Object.keys(FSM) as PatientStatus[]) {
    for (const to of FSM[from]) {
      if (!permissionFor(from, to)) {
        throw new Error(`Transição sem permissão definida: ${from} -> ${to}`);
      }
    }
  }
}
