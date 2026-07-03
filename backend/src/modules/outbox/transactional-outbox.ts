import { Prisma } from '@prisma/client';
import { DomainEvent } from '../events/base.event';
import { OutboxPort } from './outbox.port';
import { PrismaLike } from './prisma-tx.type';

/**
 * Implementação transacional do Outbox. Grava o evento na tabela outbox_event
 * usando o MESMO `tx` do agregado (atomicidade / zero perda) e atribui a
 * SEQUÊNCIA MONOTÔNICA por agregado (aggregate_sequence) na mesma transação —
 * dando a cada evento uma posição ordenada por cidadaoId, base do consumo
 * ordenado e exactly-once.
 */
export class TransactionalOutbox implements OutboxPort {
  constructor(private readonly tx: PrismaLike) {}

  async enqueue(event: DomainEvent): Promise<void> {
    const seq = await this.nextSeq(event.aggregateId);
    const stored: DomainEvent = { ...event, aggregateSeq: seq };

    await this.tx.outboxEvent.create({
      data: {
        id: event.eventId,
        aggregateId: event.aggregateId,
        type: event.type,
        partitionKey: event.partitionKey,
        payload: stored as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
  }

  /** Incrementa atomicamente o contador do agregado (lock de linha no update). */
  private async nextSeq(aggregateId: string): Promise<number> {
    const row = await this.tx.aggregateSequence.upsert({
      where: { aggregateId },
      create: { aggregateId, seq: 1 },
      update: { seq: { increment: 1 } },
    });
    return row.seq;
  }
}
