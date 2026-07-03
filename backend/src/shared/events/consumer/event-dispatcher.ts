import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainEvent } from '../../../modules/events/base.event';
import { logJson } from '../../observability/structured-logger';
import { EventHandler } from './event-handler.interface';
import { EventHandlerRegistry } from './event-handler.registry';

/**
 * Aplica um evento a todos os handlers registrados, garantindo EFFECT
 * EXACTLY-ONCE e tolerância a fora-de-ordem/replay:
 *
 *  - CONVERGENT (consumer_offset): aplica só se aggregateSeq > lastSeq e avança
 *    o offset. Eventos antigos/duplicados/replay (seq <= lastSeq) são ignorados
 *    -> estado final converge, independente da ordem de chegada.
 *  - ONCE (processed_event): aplica só se (consumer, eventId) ainda não existe;
 *    duplicata/replay viola a PK e é ignorada.
 *
 * A marcação e o efeito ocorrem na MESMA transação -> atomicidade.
 */
@Injectable()
export class EventDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  async dispatch(event: DomainEvent): Promise<void> {
    for (const handler of this.registry.handlersFor(event.type)) {
      if (handler.mode === 'CONVERGENT') {
        await this.applyConvergent(handler, event);
      } else {
        await this.applyOnce(handler, event);
      }
    }
  }

  private async applyConvergent(
    handler: EventHandler,
    event: DomainEvent,
  ): Promise<void> {
    const consumer = handler.consumerName;
    const aggregateId = event.aggregateId;
    const seq = event.aggregateSeq ?? 0;

    await this.prisma.$transaction(async (tx) => {
      const off = await tx.consumerOffset.findUnique({
        where: { consumer_aggregateId: { consumer, aggregateId } },
      });
      const last = off?.lastSeq ?? 0;
      if (seq <= last) {
        return; // antigo/duplicado/replay -> convergente, nada a fazer
      }
      await handler.handle(tx, event);
      await tx.consumerOffset.upsert({
        where: { consumer_aggregateId: { consumer, aggregateId } },
        create: { consumer, aggregateId, lastSeq: seq },
        update: { lastSeq: seq },
      });
    });
  }

  private async applyOnce(
    handler: EventHandler,
    event: DomainEvent,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({
          data: { consumer: handler.consumerName, eventId: event.eventId },
        });
        await handler.handle(tx, event);
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        logJson('info', 'EventDispatcher', 'event.skipped_duplicate', {
          consumer: handler.consumerName,
          eventId: event.eventId,
        });
        return;
      }
      throw err;
    }
  }
}
