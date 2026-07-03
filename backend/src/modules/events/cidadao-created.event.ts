import { createDomainEvent, DomainEvent } from './base.event';
import { EventType } from './event-types';

export interface CidadaoCreatedPayload extends Record<string, unknown> {
  cidadaoId: string;
  cpf: string | null;
  cns: string | null;
  nome: string;
  dataNascimento: string;
}

export function cidadaoCreatedEvent(
  payload: CidadaoCreatedPayload,
  traceId?: string,
): DomainEvent<CidadaoCreatedPayload> {
  return createDomainEvent({
    type: EventType.CIDADAO_CREATED,
    aggregateId: payload.cidadaoId,
    payload,
    schemaVersion: 1,
    traceId,
  });
}
