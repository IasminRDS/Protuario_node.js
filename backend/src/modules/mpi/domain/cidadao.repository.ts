import { Cidadao } from './cidadao.entity';
import { IdentityKey } from './identity-keys';

export const CIDADAO_REPOSITORY = Symbol('CIDADAO_REPOSITORY');

export interface HeuristicKey {
  nome: string;
  dataNascimento: Date;
  nomeMae?: string | null;
}

/**
 * Porta de persistência do agregado Cidadao e de sua identidade global.
 */
export interface CidadaoRepository {
  findByCpf(cpf: string): Promise<Cidadao | null>;
  findByCns(cns: string): Promise<Cidadao | null>;
  findByHeuristic(key: HeuristicKey): Promise<Cidadao | null>;

  /** Todos os cidadãos ATIVOS que casam a heurística (para detectar ambiguidade). */
  findActiveByHeuristic(key: HeuristicKey): Promise<Cidadao[]>;

  /** Resolução determinística por chave de identidade (cpf:/cns:/demo:). */
  findCidadaoIdByKey(key: string): Promise<string | null>;

  save(cidadao: Cidadao): Promise<void>;

  /** Insere chaves de identidade (falha com P2002 se alguma já existir). */
  insertIdentityKeys(cidadaoId: string, keys: IdentityKey[]): Promise<void>;

  /** Vincula chaves fortes a um cidadão existente, ignorando as já presentes. */
  linkIdentityKeysIgnoreConflict(
    cidadaoId: string,
    keys: IdentityKey[],
  ): Promise<void>;

  /** Preenche CPF/CNS ausentes ao reconciliar (enriquecimento não-destrutivo). */
  enrichIdentifiers(
    cidadaoId: string,
    ids: { cpf?: string | null; cns?: string | null },
  ): Promise<void>;
}
