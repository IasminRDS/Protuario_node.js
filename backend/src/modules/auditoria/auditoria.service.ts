import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditPrismaService } from './audit-prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../shared/dto/paginated-result';

export interface RegistrarAuditoriaInput {
  usuarioId?: string | bigint | null;
  modulo: string;
  operacao: string;
  objeto?: string;
  resultado?: string;
  ip?: string;
  // Enriquecimento LGPD
  entity?: string;
  entityId?: string;
  device?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  // Override explícito do tenant (default: hospital da requisição). Usado por
  // fluxos que precisam fixar o hospitalId (ex.: auditoria de export por hospital).
  hospitalId?: string | null;
}

/**
 * Auditoria imutável (RN-045/046, cap. 122-124). Só há operações de escrita
 * (append) e leitura — nunca update/delete. A falha ao auditar é registrada em
 * log mas não interrompe a operação de negócio já concluída.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditPrisma: AuditPrismaService,
  ) {}

  /**
   * Auditoria AUTÔNOMA (F0.3): grava via conexão dedicada, FORA da transação
   * principal. Um evento aqui SOBREVIVE ao rollback da tx que o originou — usado
   * para negação/erro/acesso (não-repúdio). Nunca usa `tx`, nunca `$transaction`.
   * Falha ao auditar é LOGADA e não propaga (não pode derrubar o fluxo).
   */
  async registrarAutonomo(input: RegistrarAuditoriaInput): Promise<string | null> {
    const eventId = randomUUID(); // identidade server-side (C6)
    try {
      // D1-B: EOD usa correlação READ-ONLY (não incrementa, não bloqueia SOD).
      const aggregateSeq = await this.currentAggregateSeq(
        this.auditPrisma as unknown as Prisma.TransactionClient,
        input.entity,
        input.entityId,
      );
      await this.auditPrisma.auditoria.create({
        data: {
          eventId,
          aggregateSeq,
          usuarioId: input.usuarioId != null ? BigInt(input.usuarioId) : null,
          modulo: input.modulo,
          operacao: input.operacao,
          objeto: input.objeto,
          resultado: input.resultado,
          ip: input.ip,
          entity: input.entity,
          entityId: input.entityId,
          device: input.device,
          reason: input.reason,
          hospitalId: currentHospitalId(),
        },
      });
      return eventId;
    } catch (e) {
      this.logger.error(
        `Falha ao registrar auditoria AUTÔNOMA: ${input.modulo}/${input.operacao}`,
        e instanceof Error ? e.stack : String(e),
      );
      return null;
    }
  }

  /**
   * Registra um evento de auditoria. O `eventId` é gerado AQUI, no servidor
   * (C6): UUID v4 via crypto.randomUUID — único, imprevisível e independente de
   * qualquer valor do cliente (traceId/header/body são ignorados como identidade).
   * Retorna o eventId gerado (para correlação/dedup posteriores).
   */
  /**
   * Auditoria de SUCESSO ATÔMICA (F0.1): grava usando o MESMO TransactionClient
   * da mutação. Se esta escrita falhar, o erro PROPAGA e a mutação inteira faz
   * rollback (I1). Nunca usar o canal autônomo para sucesso — criaria audit
   * fantasma no rollback. Retorna o eventId (C6).
   */
  /**
   * F0.4 — próximo número de sequência CAUSAL do agregado (entity:entityId).
   * Atômico e serializável: o `ON CONFLICT DO UPDATE ... RETURNING` tranca a
   * linha da chave, então concorrentes do MESMO agregado obtêm seq monotônico e
   * gapless (o lock vale inclusive entre canal in-tx e autônomo). Sem agregado
   * (entity/entityId ausentes) → null. Roda no MESMO client (tx ou autônomo).
   */
  private async nextAggregateSeq(
    client: Prisma.TransactionClient,
    entity?: string,
    entityId?: string,
  ): Promise<bigint | null> {
    if (!entity || !entityId) return null;
    const key = `${entity}:${entityId}`;
    const rows = await client.$queryRaw<Array<{ seq: bigint }>>(Prisma.sql`
      INSERT INTO audit_aggregate_sequence (aggregate_key, seq) VALUES (${key}, 1)
      ON CONFLICT (aggregate_key)
        DO UPDATE SET seq = audit_aggregate_sequence.seq + 1
      RETURNING seq
    `);
    return rows[0].seq;
  }

  /**
   * F0.4 / D1-B — correlação READ-ONLY do agregado para eventos EOD (negação).
   * NÃO adquire o lock de escrita (não incrementa) → não bloqueia numa tx SOD em
   * andamento e não polui o COD. Retorna a ÚLTIMA posição COMMITTADA do agregado
   * (via SELECT MVCC, sem enxergar incremento não-committado). É metadado de
   * rastreabilidade, não membro da sequência causal.
   */
  private async currentAggregateSeq(
    client: Prisma.TransactionClient,
    entity?: string,
    entityId?: string,
  ): Promise<bigint | null> {
    if (!entity || !entityId) return null;
    const key = `${entity}:${entityId}`;
    const rows = await client.$queryRaw<Array<{ seq: bigint }>>(Prisma.sql`
      SELECT seq FROM audit_aggregate_sequence WHERE aggregate_key = ${key}
    `);
    return rows.length > 0 ? rows[0].seq : null;
  }

  /**
   * F0.5 — auditoria de ACESSO DURÁVEL (AUDIT_ACCESS_SUCCESS). Escreve no client
   * fornecido (SOD = tx do request em mutações; `this.prisma` awaited em reads —
   * committado ANTES da resposta ⇒ I-G8, sem fire-and-forget). NÃO é COD: não
   * incrementa a sequência; usa `currentAggregateSeq` só como correlação read-only.
   * Propaga erro (o chamador decide: em mutação ⇒ rollback junto; em read ⇒ falha
   * a resposta). Retorna o eventId.
   */
  async registrarAcessoTx(
    client: Prisma.TransactionClient,
    input: RegistrarAuditoriaInput,
  ): Promise<string> {
    const eventId = randomUUID();
    const aggregateSeq = await this.currentAggregateSeq(client, input.entity, input.entityId);
    await client.auditoria.create({
      data: {
        eventId,
        aggregateSeq, // referência read-only (não membro do COD)
        usuarioId: input.usuarioId != null ? BigInt(input.usuarioId) : null,
        modulo: input.modulo,
        operacao: input.operacao,
        objeto: input.objeto,
        resultado: input.resultado,
        ip: input.ip,
        entity: input.entity,
        entityId: input.entityId,
        device: input.device,
        reason: input.reason,
        hospitalId: currentHospitalId(),
      },
    });
    return eventId;
  }

  async registrarTx(
    tx: Prisma.TransactionClient,
    input: RegistrarAuditoriaInput,
  ): Promise<string> {
    const eventId = randomUUID();
    const aggregateSeq = await this.nextAggregateSeq(tx, input.entity, input.entityId);
    await tx.auditoria.create({
      data: {
        eventId,
        aggregateSeq,
        usuarioId: input.usuarioId != null ? BigInt(input.usuarioId) : null,
        modulo: input.modulo,
        operacao: input.operacao,
        objeto: input.objeto,
        resultado: input.resultado,
        ip: input.ip,
        entity: input.entity,
        entityId: input.entityId,
        device: input.device,
        reason: input.reason,
        hospitalId: currentHospitalId(),
      },
    });
    return eventId;
  }

  async registrar(input: RegistrarAuditoriaInput): Promise<string | null> {
    const eventId = randomUUID(); // servidor é a ÚNICA fonte da identidade
    try {
      await this.prisma.auditoria.create({
        data: {
          eventId,
          usuarioId:
            input.usuarioId != null ? BigInt(input.usuarioId) : null,
          modulo: input.modulo,
          operacao: input.operacao,
          objeto: input.objeto,
          resultado: input.resultado,
          ip: input.ip,
          entity: input.entity,
          entityId: input.entityId,
          device: input.device,
          reason: input.reason,
          metadata: input.metadata,
          // Tenant: override explícito quando fornecido; senão o hospital da requisição.
          hospitalId:
            input.hospitalId !== undefined
              ? input.hospitalId
              : currentHospitalId(),
        },
      });
      return eventId;
    } catch (e) {
      this.logger.error(
        `Falha ao registrar auditoria: ${input.modulo}/${input.operacao}`,
        e instanceof Error ? e.stack : String(e),
      );
      return null;
    }
  }

  async listar(
    query: PaginationQueryDto,
    filtros: { modulo?: string; usuarioId?: string },
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      ...(filtros.modulo ? { modulo: filtros.modulo } : {}),
      ...(filtros.usuarioId ? { usuarioId: BigInt(filtros.usuarioId) } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        orderBy: { dataEvento: query.order },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.pageSize);
  }
}
