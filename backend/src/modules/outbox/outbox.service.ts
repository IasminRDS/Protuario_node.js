import { Injectable } from '@nestjs/common';
import { OutboxEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Linha retornada pelo claim atômico (colunas em snake_case do banco). */
export interface ClaimedOutboxRow {
  id: string;
  aggregate_id: string;
  type: string;
  payload: unknown;
  partition_key: string;
  attempts: number;
}

/**
 * Operações do Outbox usadas pelo worker. A concorrência é resolvida no banco:
 *  - claimBatch: SELECT ... FOR UPDATE SKIP LOCKED -> um evento só é pego por
 *    UM worker, permitindo múltiplas instâncias sem duplicar publicação.
 *  - reapStale: devolve a PENDING os PROCESSING órfãos (worker caiu no meio),
 *    garantindo que nenhum evento fique preso -> sem perda.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reivindica atomicamente um lote de eventos PENDING, marcando-os PROCESSING.
   * `FOR UPDATE SKIP LOCKED` impede que dois workers peguem a mesma linha.
   */
  claimBatch(limit: number): Promise<ClaimedOutboxRow[]> {
    return this.prisma.$queryRaw<ClaimedOutboxRow[]>(Prisma.sql`
      UPDATE "outbox_event"
      SET "status" = 'PROCESSING', "claimed_at" = NOW()
      WHERE "id" IN (
        SELECT "id" FROM "outbox_event"
        WHERE "status" = 'PENDING' AND "available_at" <= NOW()
        ORDER BY "created_at"
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING "id", "aggregate_id", "type", "payload", "partition_key", "attempts"
    `);
  }

  /** Reenfileira PROCESSING órfãos (worker morto antes de concluir). */
  reapStale(staleSeconds: number): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_event"
      SET "status" = 'PENDING', "claimed_at" = NULL
      WHERE "status" = 'PROCESSING'
        AND "claimed_at" < NOW() - make_interval(secs => (${staleSeconds})::int)
    `);
  }

  markSent(id: string): Promise<OutboxEvent> {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), claimedAt: null },
    });
  }

  /**
   * Falha na publicação: agenda retry com backoff (volta a PENDING) ou, atingido
   * o máximo, marca FAILED (dead-letter) com a causa registrada em last_error.
   */
  async markRetryOrFailed(
    id: string,
    currentAttempts: number,
    maxAttempts: number,
    error: string,
  ): Promise<void> {
    const attempts = currentAttempts + 1;
    if (attempts >= maxAttempts) {
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: 'FAILED',
          attempts,
          claimedAt: null,
          lastError: error.slice(0, 2000),
        },
      });
      return;
    }
    const backoffMs = Math.min(60_000, 1000 * 2 ** attempts);
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts,
        claimedAt: null,
        availableAt: new Date(Date.now() + backoffMs),
        lastError: error.slice(0, 2000),
      },
    });
  }

  /** Remove eventos SENT antigos (retenção) para evitar table bloat. */
  purgeSent(retentionHours: number): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "outbox_event"
      WHERE "status" = 'SENT'
        AND "sent_at" < NOW() - make_interval(hours => (${retentionHours})::int)
    `);
  }

  // -------- Observabilidade / Dead-letter --------
  countByStatus(): Promise<{ status: string; total: number }[]> {
    return this.prisma.$queryRaw<{ status: string; total: number }[]>(Prisma.sql`
      SELECT "status", COUNT(*)::int AS "total"
      FROM "outbox_event" GROUP BY "status"
    `);
  }

  listDeadLetter(limit: number): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
