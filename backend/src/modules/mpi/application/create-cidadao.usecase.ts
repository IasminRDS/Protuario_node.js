import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cidadaoCreatedEvent } from '../../events/cidadao-created.event';
import {
  cidadaoResolvedEvent,
  MatchStrategy,
} from '../../events/cidadao-resolved.event';
import { logJson } from '../../../shared/observability/structured-logger';
import { DomainError } from '../../../shared/errors/domain-error';
import { Cidadao } from '../domain/cidadao.entity';
import {
  CIDADAO_REPOSITORY,
  CidadaoRepository,
} from '../domain/cidadao.repository';
import { computeIdentityKeys, strongKeys } from '../domain/identity-keys';
import { CNS } from '../domain/value-objects/cns.vo';
import { CPF } from '../domain/value-objects/cpf.vo';
import {
  MPI_UNIT_OF_WORK,
  MpiTxContext,
  MpiUnitOfWork,
} from './ports/mpi-unit-of-work';

export interface CreateCidadaoInput {
  nome: string;
  dataNascimento: string; // ISO
  cpf?: string | null;
  cns?: string | null;
  nomeMae?: string | null;
  sexo?: string | null;
  traceId?: string;
}

export interface CreateCidadaoOutput {
  cidadaoId: string;
  resolved: boolean;
  matchedBy?: MatchStrategy;
}

interface Ids {
  cpf: string | null;
  cns: string | null;
  nome: string;
  dataNascimento: Date;
  nomeMae?: string | null;
}

/**
 * Cria ou resolve (deduplica) a identidade nacional do cidadão de forma
 * DETERMINÍSTICA por chaves de identidade (cidadao_identity_key):
 *   1) resolução prévia por chave forte (CPF/CNS) e por demografia exata;
 *   2) demografia ambígua (>1) => NEEDS_RECONCILIATION (não adivinha);
 *   3) criação insere as chaves na MESMA transação — colisão (P2002) sob
 *      corrida resolve para o vencedor. Reconciliação: vincula CPF/CNS trazidos
 *      a um registro existente (fecha o split CPF × sem-CPF no caso comum).
 */
@Injectable()
export class CreateCidadaoUseCase {
  constructor(
    @Inject(MPI_UNIT_OF_WORK) private readonly uow: MpiUnitOfWork,
    @Inject(CIDADAO_REPOSITORY) private readonly readRepo: CidadaoRepository,
  ) {}

  async execute(input: CreateCidadaoInput): Promise<CreateCidadaoOutput> {
    const cpfVo = CPF.createOptional(input.cpf);
    const cnsVo = CNS.createOptional(input.cns);
    const ids: Ids = {
      cpf: cpfVo?.value ?? null,
      cns: cnsVo?.value ?? null,
      nome: input.nome,
      dataNascimento: new Date(input.dataNascimento),
      nomeMae: input.nomeMae,
    };

    try {
      return await this.uow.execute(async (ctx: MpiTxContext) => {
        const existing = await this.resolveDeterministic(ctx.cidadaoRepo, ids);
        if (existing) {
          await this.reconcileAndResolve(ctx, existing, ids, input.traceId);
          return {
            cidadaoId: existing.cidadaoId,
            resolved: true,
            matchedBy: existing.matchedBy,
          };
        }

        const cidadao = Cidadao.create({
          nome: ids.nome,
          dataNascimento: ids.dataNascimento,
          cpf: cpfVo,
          cns: cnsVo,
          nomeMae: ids.nomeMae,
          sexo: input.sexo,
        });
        await ctx.cidadaoRepo.save(cidadao);
        await ctx.cidadaoRepo.insertIdentityKeys(
          cidadao.id,
          computeIdentityKeys(ids),
        );

        await ctx.outbox.enqueue(
          cidadaoCreatedEvent(
            {
              cidadaoId: cidadao.id,
              cpf: cidadao.cpf,
              cns: cidadao.cns,
              nome: cidadao.nome,
              dataNascimento: cidadao.dataNascimento.toISOString(),
            },
            input.traceId,
          ),
        );
        logJson('info', 'CreateCidadao', 'cidadao.created', {
          traceId: input.traceId,
          cidadaoId: cidadao.id,
        });
        return { cidadaoId: cidadao.id, resolved: false };
      });
    } catch (err) {
      // Corrida: outra requisição criou a MESMA identidade (colisão de chave).
      if (this.isUniqueViolation(err)) {
        const winner = await this.resolveDeterministic(this.readRepo, ids);
        if (winner) {
          logJson('warn', 'CreateCidadao', 'cidadao.race_resolved', {
            traceId: input.traceId,
            cidadaoId: winner.cidadaoId,
            matchedBy: winner.matchedBy,
          });
          await this.uow.execute((ctx) =>
            this.reconcileAndResolve(ctx, winner, ids, input.traceId),
          );
          return {
            cidadaoId: winner.cidadaoId,
            resolved: true,
            matchedBy: winner.matchedBy,
          };
        }
      }
      throw err;
    }
  }

  /** Resolução determinística: CPF -> CNS -> demografia exata (ambígua => erro). */
  private async resolveDeterministic(
    repo: CidadaoRepository,
    ids: Ids,
  ): Promise<{ cidadaoId: string; matchedBy: MatchStrategy } | null> {
    if (ids.cpf) {
      const id = await repo.findCidadaoIdByKey(`cpf:${ids.cpf}`);
      if (id) return { cidadaoId: id, matchedBy: 'CPF' };
    }
    if (ids.cns) {
      const id = await repo.findCidadaoIdByKey(`cns:${ids.cns}`);
      if (id) return { cidadaoId: id, matchedBy: 'CNS' };
    }
    const matches = await repo.findActiveByHeuristic({
      nome: ids.nome,
      dataNascimento: ids.dataNascimento,
      nomeMae: ids.nomeMae,
    });
    if (matches.length === 1) {
      return { cidadaoId: matches[0].id, matchedBy: 'HEURISTIC' };
    }
    if (matches.length > 1) {
      throw new DomainError(
        'NEEDS_RECONCILIATION',
        'Múltiplos cidadãos com os mesmos dados demográficos — requer reconciliação manual.',
      );
    }
    return null;
  }

  /** Vincula CPF/CNS trazidos ao cidadão resolvido e emite CidadaoResolved. */
  private async reconcileAndResolve(
    ctx: MpiTxContext,
    resolved: { cidadaoId: string; matchedBy: MatchStrategy },
    ids: Ids,
    traceId?: string,
  ): Promise<void> {
    const missing = strongKeys(ids.cpf, ids.cns);
    if (missing.length > 0) {
      await ctx.cidadaoRepo.linkIdentityKeysIgnoreConflict(
        resolved.cidadaoId,
        missing,
      );
      await ctx.cidadaoRepo.enrichIdentifiers(resolved.cidadaoId, {
        cpf: ids.cpf,
        cns: ids.cns,
      });
    }
    await ctx.outbox.enqueue(
      cidadaoResolvedEvent(
        { cidadaoId: resolved.cidadaoId, matchedBy: resolved.matchedBy },
        traceId,
      ),
    );
    logJson('info', 'CreateCidadao', 'cidadao.resolved', {
      traceId,
      cidadaoId: resolved.cidadaoId,
      matchedBy: resolved.matchedBy,
    });
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
    );
  }
}
