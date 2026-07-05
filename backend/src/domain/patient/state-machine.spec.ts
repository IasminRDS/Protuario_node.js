import {
  canTransition,
  isTerminal,
  FSM,
  PATIENT_STATUSES,
} from './state-machine';
import { PatientRules } from './rules';
import {
  assertConsistent,
  permissionFor,
  transitionsFrom,
} from './transitions';
import { Permission } from '../../shared/rbac/permissions';
import { DomainError } from '../../shared/errors/domain-error';

describe('Patient FSM (domínio puro)', () => {
  it('cobre exatamente os 6 estados clínicos', () => {
    expect(PATIENT_STATUSES.sort()).toEqual(
      [
        'DISCHARGED',
        'IN_CONSULTATION',
        'IN_TRIAGE',
        'REGISTERED',
        'UNDER_OBSERVATION',
        'WAITING_DOCTOR',
      ].sort(),
    );
  });

  describe('canTransition', () => {
    it('aceita o caminho feliz', () => {
      expect(canTransition('REGISTERED', 'IN_TRIAGE')).toBe(true);
      expect(canTransition('IN_TRIAGE', 'WAITING_DOCTOR')).toBe(true);
      expect(canTransition('WAITING_DOCTOR', 'IN_CONSULTATION')).toBe(true);
      expect(canTransition('IN_CONSULTATION', 'DISCHARGED')).toBe(true);
      expect(canTransition('IN_CONSULTATION', 'UNDER_OBSERVATION')).toBe(true);
      expect(canTransition('UNDER_OBSERVATION', 'IN_CONSULTATION')).toBe(true);
    });

    it('rejeita saltos inválidos', () => {
      expect(canTransition('REGISTERED', 'IN_CONSULTATION')).toBe(false);
      expect(canTransition('REGISTERED', 'DISCHARGED')).toBe(false);
      expect(canTransition('WAITING_DOCTOR', 'DISCHARGED')).toBe(false);
      expect(canTransition('DISCHARGED', 'IN_CONSULTATION')).toBe(false);
    });
  });

  it('DISCHARGED é terminal', () => {
    expect(isTerminal('DISCHARGED')).toBe(true);
    expect(isTerminal('IN_CONSULTATION')).toBe(false);
  });

  describe('PatientRules.assertTransition', () => {
    it('não lança em transição válida', () => {
      expect(() => PatientRules.assertTransition('REGISTERED', 'IN_TRIAGE')).not.toThrow();
    });
    it('é idempotente para o mesmo estado', () => {
      expect(() => PatientRules.assertTransition('IN_TRIAGE', 'IN_TRIAGE')).not.toThrow();
    });
    it('lança DomainError em transição inválida', () => {
      expect(() =>
        PatientRules.assertTransition('REGISTERED', 'DISCHARGED'),
      ).toThrow(DomainError);
    });
  });

  describe('transitions (permissões por aresta)', () => {
    it('toda aresta do FSM tem permissão definida', () => {
      expect(() => assertConsistent()).not.toThrow();
    });
    it('mapeia a permissão correta', () => {
      expect(permissionFor('REGISTERED', 'IN_TRIAGE')).toBe(Permission.TRIAGE_WRITE);
      expect(permissionFor('WAITING_DOCTOR', 'IN_CONSULTATION')).toBe(
        Permission.ENCOUNTER_WRITE,
      );
      expect(permissionFor('REGISTERED', 'DISCHARGED')).toBeNull();
    });
    it('lista as transições possíveis de um estado', () => {
      expect(transitionsFrom('IN_CONSULTATION').map((t) => t.to).sort()).toEqual(
        ['DISCHARGED', 'UNDER_OBSERVATION'],
      );
      expect(transitionsFrom('DISCHARGED')).toHaveLength(0);
    });
  });

  it('FSM e catálogo de estados são coerentes', () => {
    for (const s of PATIENT_STATUSES) {
      expect(Array.isArray(FSM[s])).toBe(true);
    }
  });
});
