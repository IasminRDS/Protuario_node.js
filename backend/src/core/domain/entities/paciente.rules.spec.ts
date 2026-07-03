import { DomainError } from '../../../shared/errors/domain-error';
import { PacienteRules } from './paciente.rules';

describe('PacienteRules', () => {
  describe('garantirIdentificacao (RN-006)', () => {
    it('aceita quando há CPF', () => {
      expect(() => PacienteRules.garantirIdentificacao('123', null)).not.toThrow();
    });

    it('aceita quando há CNS', () => {
      expect(() => PacienteRules.garantirIdentificacao(null, '999')).not.toThrow();
    });

    it('rejeita quando não há CPF nem CNS', () => {
      expect(() => PacienteRules.garantirIdentificacao(null, null)).toThrow(
        DomainError,
      );
      expect(() => PacienteRules.garantirIdentificacao('  ', '')).toThrow(
        DomainError,
      );
    });
  });

  describe('normalizarDocumento', () => {
    it('remove máscara mantendo apenas dígitos', () => {
      expect(PacienteRules.normalizarDocumento('123.456.789-00')).toBe(
        '12345678900',
      );
    });

    it('retorna null para vazio/nulo', () => {
      expect(PacienteRules.normalizarDocumento('')).toBeNull();
      expect(PacienteRules.normalizarDocumento(undefined)).toBeNull();
      expect(PacienteRules.normalizarDocumento('---')).toBeNull();
    });
  });

  describe('garantirNascimentoValido', () => {
    it('aceita data passada', () => {
      expect(() =>
        PacienteRules.garantirNascimentoValido(new Date('1990-01-01')),
      ).not.toThrow();
    });

    it('rejeita data futura', () => {
      const futuro = new Date(Date.now() + 86_400_000);
      expect(() => PacienteRules.garantirNascimentoValido(futuro)).toThrow(
        DomainError,
      );
    });
  });
});
