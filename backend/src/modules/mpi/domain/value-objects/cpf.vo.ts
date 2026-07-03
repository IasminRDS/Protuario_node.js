import { DomainError } from '../../../../shared/errors/domain-error';

/**
 * Value Object CPF: normaliza (só dígitos) e valida os dígitos verificadores.
 * Imutável. Use `createOptional` quando o CPF pode ausentar (RN nacional:
 * único quando presente, mas nem todo cidadão tem CPF — recém-nascidos etc.).
 */
export class CPF {
  private constructor(public readonly value: string) {}

  static create(raw: string): CPF {
    const digits = raw.replace(/\D/g, '');
    if (!CPF.isValid(digits)) {
      throw new DomainError('CPF_INVALIDO', 'CPF inválido.');
    }
    return new CPF(digits);
  }

  static createOptional(raw?: string | null): CPF | null {
    if (!raw || raw.replace(/\D/g, '').length === 0) {
      return null;
    }
    return CPF.create(raw);
  }

  static isValid(digits: string): boolean {
    if (!/^\d{11}$/.test(digits)) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false; // todos iguais

    const calcCheck = (len: number): number => {
      let sum = 0;
      for (let i = 0; i < len; i++) {
        sum += parseInt(digits[i], 10) * (len + 1 - i);
      }
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };

    return (
      calcCheck(9) === parseInt(digits[9], 10) &&
      calcCheck(10) === parseInt(digits[10], 10)
    );
  }
}
