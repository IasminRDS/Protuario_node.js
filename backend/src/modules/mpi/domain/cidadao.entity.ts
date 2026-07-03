import { v7 as uuidv7 } from 'uuid';
import { DomainError } from '../../../shared/errors/domain-error';
import { identityFingerprint } from './identity-fingerprint';
import { CNS } from './value-objects/cns.vo';
import { CPF } from './value-objects/cpf.vo';

export type CidadaoStatus = 'ATIVO' | 'OBITO' | 'UNIFICADO';

interface CidadaoProps {
  id: string;
  nome: string;
  dataNascimento: Date;
  cpf: string | null;
  cns: string | null;
  nomeMae: string | null;
  sexo: string | null;
  status: CidadaoStatus;
  fingerprint: string;
}

/**
 * Agregado raiz do MPI. Independente de framework/ORM. A identidade nacional
 * (cidadaoId) é um UUID v7 gerado na criação.
 */
export class Cidadao {
  private constructor(private readonly props: CidadaoProps) {}

  get id(): string {
    return this.props.id;
  }
  get nome(): string {
    return this.props.nome;
  }
  get dataNascimento(): Date {
    return this.props.dataNascimento;
  }
  get cpf(): string | null {
    return this.props.cpf;
  }
  get cns(): string | null {
    return this.props.cns;
  }
  get nomeMae(): string | null {
    return this.props.nomeMae;
  }
  get sexo(): string | null {
    return this.props.sexo;
  }
  get status(): CidadaoStatus {
    return this.props.status;
  }
  get fingerprint(): string {
    return this.props.fingerprint;
  }

  /** Cria um novo cidadão nacional, aplicando invariantes de domínio. */
  static create(input: {
    nome: string;
    dataNascimento: Date;
    cpf: CPF | null;
    cns: CNS | null;
    nomeMae?: string | null;
    sexo?: string | null;
  }): Cidadao {
    if (!input.nome || input.nome.trim().length < 2) {
      throw new DomainError('NOME_INVALIDO', 'Nome do cidadão é obrigatório.');
    }
    if (input.dataNascimento.getTime() > Date.now()) {
      throw new DomainError(
        'DATA_NASCIMENTO_INVALIDA',
        'A data de nascimento não pode ser futura.',
      );
    }
    // Fallback de identificação (RN nacional): exige CPF, CNS ou dados
    // demográficos mínimos para o matching heurístico (nome + nascimento).
    const temIdentificador = !!input.cpf || !!input.cns;
    const temDemografico = !!input.nome && !!input.dataNascimento;
    if (!temIdentificador && !temDemografico) {
      throw new DomainError(
        'IDENTIFICACAO_INSUFICIENTE',
        'Informe CPF/CNS ou dados demográficos mínimos (nome e nascimento).',
      );
    }

    const cpf = input.cpf?.value ?? null;
    const cns = input.cns?.value ?? null;
    const nome = input.nome.trim();
    const nomeMae = input.nomeMae?.trim() ?? null;

    return new Cidadao({
      id: uuidv7(),
      nome,
      dataNascimento: input.dataNascimento,
      cpf,
      cns,
      nomeMae,
      sexo: input.sexo ?? null,
      status: 'ATIVO',
      fingerprint: identityFingerprint({
        cpf,
        cns,
        nome,
        dataNascimento: input.dataNascimento,
        nomeMae,
      }),
    });
  }

  /** Reidrata a partir da persistência (sem revalidar invariantes). */
  static restore(props: CidadaoProps): Cidadao {
    return new Cidadao(props);
  }

  toSnapshot(): CidadaoProps {
    return { ...this.props };
  }
}
