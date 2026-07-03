import { Cidadao as CidadaoRow } from '@prisma/client';
import { Cidadao, CidadaoStatus } from '../domain/cidadao.entity';
import {
  CidadaoRepository,
  HeuristicKey,
} from '../domain/cidadao.repository';
import { IdentityKey } from '../domain/identity-keys';
import { PrismaLike } from '../../outbox/prisma-tx.type';

/**
 * Implementação Prisma do repositório de Cidadao e da identidade global.
 * Aceita a instância base OU o cliente transacional (via UoW).
 */
export class PrismaCidadaoRepository implements CidadaoRepository {
  constructor(private readonly db: PrismaLike) {}

  async findByCpf(cpf: string): Promise<Cidadao | null> {
    const row = await this.db.cidadao.findUnique({ where: { cpf } });
    return row ? this.toDomain(row) : null;
  }

  async findByCns(cns: string): Promise<Cidadao | null> {
    const row = await this.db.cidadao.findFirst({ where: { cns } });
    return row ? this.toDomain(row) : null;
  }

  async findByHeuristic(key: HeuristicKey): Promise<Cidadao | null> {
    const row = await this.db.cidadao.findFirst({
      where: this.heuristicWhere(key),
    });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByHeuristic(key: HeuristicKey): Promise<Cidadao[]> {
    const rows = await this.db.cidadao.findMany({
      where: this.heuristicWhere(key),
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findCidadaoIdByKey(key: string): Promise<string | null> {
    const row = await this.db.cidadaoIdentityKey.findUnique({ where: { key } });
    return row ? row.cidadaoId : null;
  }

  async save(cidadao: Cidadao): Promise<void> {
    const s = cidadao.toSnapshot();
    await this.db.cidadao.create({
      data: {
        id: s.id,
        nome: s.nome,
        cpf: s.cpf,
        cns: s.cns,
        nomeMae: s.nomeMae,
        dataNascimento: s.dataNascimento,
        sexo: s.sexo,
        status: s.status,
        fingerprint: s.fingerprint,
      },
    });
  }

  async insertIdentityKeys(
    cidadaoId: string,
    keys: IdentityKey[],
  ): Promise<void> {
    if (keys.length === 0) return;
    // createMany sem skipDuplicates: colisão => P2002 (rede de segurança da corrida).
    await this.db.cidadaoIdentityKey.createMany({
      data: keys.map((k) => ({ key: k.key, kind: k.kind, cidadaoId })),
    });
  }

  async linkIdentityKeysIgnoreConflict(
    cidadaoId: string,
    keys: IdentityKey[],
  ): Promise<void> {
    if (keys.length === 0) return;
    await this.db.cidadaoIdentityKey.createMany({
      data: keys.map((k) => ({ key: k.key, kind: k.kind, cidadaoId })),
      skipDuplicates: true,
    });
  }

  async enrichIdentifiers(
    cidadaoId: string,
    ids: { cpf?: string | null; cns?: string | null },
  ): Promise<void> {
    const row = await this.db.cidadao.findUnique({ where: { id: cidadaoId } });
    if (!row) return;
    const data: { cpf?: string; cns?: string } = {};
    if (ids.cpf && !row.cpf) data.cpf = ids.cpf;
    if (ids.cns && !row.cns) data.cns = ids.cns;
    if (Object.keys(data).length > 0) {
      await this.db.cidadao.update({ where: { id: cidadaoId }, data });
    }
  }

  private heuristicWhere(key: HeuristicKey) {
    return {
      nome: { equals: key.nome.trim(), mode: 'insensitive' as const },
      dataNascimento: key.dataNascimento,
      ...(key.nomeMae
        ? {
            nomeMae: {
              equals: key.nomeMae.trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      status: 'ATIVO',
      mergedInto: null,
    };
  }

  private toDomain(row: CidadaoRow): Cidadao {
    return Cidadao.restore({
      id: row.id,
      nome: row.nome,
      dataNascimento: row.dataNascimento,
      cpf: row.cpf,
      cns: row.cns,
      nomeMae: row.nomeMae,
      sexo: row.sexo,
      status: row.status as CidadaoStatus,
      fingerprint: row.fingerprint,
    });
  }
}
