import { Module } from '@nestjs/common';
import { EventBusModule } from '../../shared/events/event-bus.module';
import { OutboxController } from './outbox.controller';
import { OutboxPublisherWorker } from './outbox-publisher.worker';
import { OutboxService } from './outbox.service';

/**
 * Módulo Outbox: expõe OutboxService (leitura/despacho) e roda o worker de
 * publicação. A escrita transacional (TransactionalOutbox) é instanciada pela
 * Unit of Work de cada contexto dentro da própria transação.
 */
@Module({
  imports: [EventBusModule],
  controllers: [OutboxController],
  providers: [OutboxService, OutboxPublisherWorker],
  exports: [OutboxService],
})
export class OutboxModule {}
