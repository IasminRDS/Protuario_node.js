import { DomainError } from '../../../../shared/errors/domain-error';
import { CPF } from './cpf.vo';

describe('CPF (Value Object)', () => {
  it('normaliza e aceita CPF válido com máscara', () => {
    expect(CPF.create('529.982.247-25').value).toBe('52998224725');
  });

  it('rejeita CPF com dígito verificador inválido', () => {
    expect(() => CPF.create('529.982.247-24')).toThrow(DomainError);
  });

  it('rejeita sequência de dígitos iguais', () => {
    expect(() => CPF.create('111.111.111-11')).toThrow(DomainError);
  });

  it('createOptional retorna null para ausência', () => {
    expect(CPF.createOptional(undefined)).toBeNull();
    expect(CPF.createOptional('')).toBeNull();
  });
});
