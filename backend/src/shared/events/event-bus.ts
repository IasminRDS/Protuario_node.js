import { DomainEvent } from '../../modules/events/base.event';

export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Porta de saída para o backbone de eventos. O Outbox worker é o único
 * produtor: lê eventos persistidos e os publica aqui. `key` é o partitionKey
 * (cidadaoId), garantindo ordenação por stream no broker.
 */
export interface EventBus {
  publish(topic: string, event: DomainEvent): Promise<void>;
}
