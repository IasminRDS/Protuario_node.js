import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { logJson } from '../observability/structured-logger';

/**
 * Deduplicação de consumidores. `runOnce` registra (consumer, eventId) na tabela
 * processed_event (PK única) e executa o handler NA MESMA transação. Se o evento
 * já foi processado por aquele consumidor, a inserção viola a PK (P2002) e o
 * efeito é ignorado — tornando a entrega at-least-once do Outbox em efeito
 * EXACTLY-ONCE por consumidor. Handlers devem usar o `tx` recebido para que a
 * marcação e o efeito sejam atômicos.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async runOnce(
    consumer: string,
    eventId: string,
    handler: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { consumer, eventId } });
        await handler(tx);
      });
      return true; // processado agora
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        logJson('info', 'Idempotency', 'event.skipped_duplicate', {
          consumer,
          eventId,
        });
        return false; // já processado anteriormente
      }
      throw err;
    }
  }
}
