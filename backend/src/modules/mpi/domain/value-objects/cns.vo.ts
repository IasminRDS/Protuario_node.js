import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * Value Object CNS (Cartão Nacional de Saúde): 15 dígitos com validação de
 * checksum (módulo 11). Opcional no cadastro nacional.
 */
export class CNS {
  private constructor(public readonly value: string) {}

  static create(raw: string): CNS {
    const digits = raw.replace(/\D/g, '');
    if (!CNS.isValid(digits)) {
      throw new DomainError('CNS_INVALIDO', 'CNS inválido.');
    }
    return new CNS(digits);
  }

  static createOptional(raw?: string | null): CNS | null {
    if (!raw || raw.replace(/\D/g, '').length === 0) {
      return null;
    }
    return CNS.create(raw);
  }

  static isValid(digits: string): boolean {
    if (!/^\d{15}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 15; i++) {
      sum += parseInt(digits[i], 10) * (15 - i);
    }
    return sum % 11 === 0;
  }
}
