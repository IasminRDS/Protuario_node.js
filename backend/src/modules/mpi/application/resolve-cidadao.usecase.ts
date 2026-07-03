import { Inject, Injectable } from '@nestjs/common';
import { MatchStrategy } from '../../events/cidadao-resolved.event';
import { CNS } from '../domain/value-objects/cns.vo';
import { CPF } from '../domain/value-objects/cpf.vo';
import {
  CIDADAO_REPOSITORY,
  CidadaoRepository,
} from '../domain/cidadao.repository';

export interface ResolveCidadaoInput {
  cpf?: string | null;
  cns?: string | null;
  nome?: string | null;
  dataNascimento?: string | null;
  nomeMae?: string | null;
}

export interface ResolveCidadaoOutput {
  status: 'MATCHED' | 'NO_MATCH';
  cidadaoId?: string;
  matchedBy?: MatchStrategy;
}

/**
 * Resolve a identidade nacional a partir de identificadores/heurística.
 * Operação de LEITURA (não muta, não emite evento). Deduplicação: CPF -> CNS
 * -> heurística (nome + nascimento + nome da mãe).
 */
@Injectable()
export class ResolveCidadaoUseCase {
  constructor(
    @Inject(CIDADAO_REPOSITORY)
    private readonly cidadaoRepo: CidadaoRepository,
  ) {}

  async execute(input: ResolveCidadaoInput): Promise<ResolveCidadaoOutput> {
    const cpf = CPF.createOptional(input.cpf);
    if (cpf) {
      const byCpf = await this.cidadaoRepo.findByCpf(cpf.value);
      if (byCpf) return { status: 'MATCHED', cidadaoId: byCpf.id, matchedBy: 'CPF' };
    }

    const cns = CNS.createOptional(input.cns);
    if (cns) {
      const byCns = await this.cidadaoRepo.findByCns(cns.value);
      if (byCns) return { status: 'MATCHED', cidadaoId: byCns.id, matchedBy: 'CNS' };
    }

    if (input.nome && input.dataNascimento) {
      const byHeuristic = await this.cidadaoRepo.findByHeuristic({
        nome: input.nome,
        dataNascimento: new Date(input.dataNascimento),
        nomeMae: input.nomeMae,
      });
      if (byHeuristic) {
        return { status: 'MATCHED', cidadaoId: byHeuristic.id, matchedBy: 'HEURISTIC' };
      }
    }

    return { status: 'NO_MATCH' };
  }
}
