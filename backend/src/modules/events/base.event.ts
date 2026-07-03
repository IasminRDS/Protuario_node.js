import { v7 as uuidv7 } from 'uuid';

/**
 * Envelope padrão de evento de domínio do SNPE. Imutável e auto-descritivo.
 * A chave de partição é sempre o cidadaoId (garante ordenação por stream).
 */
export interface DomainEvent<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly type: string;
  readonly occurredAt: string; // ISO-8601
  readonly aggregateId: string; // cidadaoId
  readonly partitionKey: string; // = aggregateId
  readonly schemaVersion: number;
  // Posição monotônica do evento dentro do stream do agregado. Atribuída no
  // enqueue do Outbox (mesma transação). Base da ordenação no consumo.
  readonly aggregateSeq?: number;
  readonly traceId?: string;
  readonly payload: T;
}

export function createDomainEvent<T extends Record<string, unknown>>(params: {
  type: string;
  aggregateId: string;
  payload: T;
  schemaVersion?: number;
  traceId?: string;
}): DomainEvent<T> {
  return Object.freeze({
    eventId: uuidv7(),
    type: params.type,
    occurredAt: new Date().toISOString(),
    aggregateId: params.aggregateId,
    partitionKey: params.aggregateId, // cidadaoId
    schemaVersion: params.schemaVersion ?? 1,
    traceId: params.traceId,
    payload: Object.freeze({ ...params.payload }),
  });
}
