import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../../modules/events/base.event';
import { logJson } from '../observability/structured-logger';
import { EventBus } from './event-bus';

/**
 * Adapter mock/substituível: publica o evento como log estruturado. Usado quando
 * KAFKA_ENABLED=false (infra Kafka indisponível). Mantém o contrato do EventBus,
 * portanto trocar por KafkaEventBus não afeta domínio, aplicação nem worker.
 */
@Injectable()
export class LoggingEventBus implements EventBus {
  async publish(topic: string, event: DomainEvent): Promise<void> {
    logJson('info', 'EventBus', 'event.published', {
      traceId: event.traceId,
      topic,
      key: event.partitionKey,
      eventId: event.eventId,
      type: event.type,
      schemaVersion: event.schemaVersion,
    });
  }
}
