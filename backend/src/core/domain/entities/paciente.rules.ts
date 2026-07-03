import { DomainError } from '../../../shared/errors/domain-error';

/**
 * Regras/invariantes de domínio do Paciente, independentes de framework e de
 * banco (Clean Architecture / DDD — cap. 65/83). Testáveis isoladamente.
 */
export const PacienteRules = {
  /**
   * RN-006: identificação mínima obrigatória. Nesta implementação exigimos ao
   * menos um identificador nacional (CPF ou CNS) — ver análise crítica A1.
   */
  garantirIdentificacao(cpf?: string | null, cns?: string | null): void {
    const temCpf = !!cpf && cpf.trim().length > 0;
    const temCns = !!cns && cns.trim().length > 0;
    if (!temCpf && !temCns) {
      throw new DomainError(
        'IDENTIFICACAO_OBRIGATORIA',
        'Informe ao menos um identificador do paciente (CPF ou CNS).',
      );
    }
  },

  /** Normaliza CPF/CNS para apenas dígitos (comparação/unicidade consistente). */
  normalizarDocumento(doc?: string | null): string | null {
    if (!doc) return null;
    const digitos = doc.replace(/\D/g, '');
    return digitos.length > 0 ? digitos : null;
  },

  /** RN-006: data de nascimento não pode ser futura. */
  garantirNascimentoValido(dataNascimento: Date): void {
    if (dataNascimento.getTime() > Date.now()) {
      throw new DomainError(
        'DATA_NASCIMENTO_INVALIDA',
        'A data de nascimento não pode ser futura.',
      );
    }
  },
};
