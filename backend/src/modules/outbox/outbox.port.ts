import { DomainEvent } from '../events/base.event';

export const OUTBOX_PORT = Symbol('OUTBOX_PORT');

/**
 * Porta do Outbox usada pela camada de aplicação. A implementação escreve o
 * evento na MESMA transação do agregado (garantia transacional / zero loss).
 */
export interface OutboxPort {
  enqueue(event: DomainEvent): Promise<void>;
}
