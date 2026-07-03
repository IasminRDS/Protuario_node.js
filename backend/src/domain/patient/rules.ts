import { DomainError } from '../../shared/errors/domain-error';
import { PatientStatus, canTransition } from './state-machine';

/**
 * Invariantes de domínio do fluxo do paciente. Puras e testáveis.
 */
export const PatientRules = {
  /** Garante que a transição é permitida pelo FSM; senão, DomainError. */
  assertTransition(from: PatientStatus, to: PatientStatus): void {
    if (from === to) return; // idempotente
    if (!canTransition(from, to)) {
      throw new DomainError(
        'TRANSICAO_INVALIDA',
        `Transição de estado inválida: ${from} → ${to}.`,
      );
    }
  },
};
