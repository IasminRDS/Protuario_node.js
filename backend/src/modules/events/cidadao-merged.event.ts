import { createDomainEvent, DomainEvent } from './base.event';
import { EventType } from './event-types';

export interface CidadaoMergedPayload extends Record<string, unknown> {
  survivorId: string;
  mergedId: string;
}

/**
 * Emitido quando dois registros da MESMA pessoa são unificados (merge
 * determinístico). Consumidores devem redirecionar referências de `mergedId`
 * para `survivorId`.
 */
export function cidadaoMergedEvent(
  payload: CidadaoMergedPayload,
  traceId?: string,
): DomainEvent<CidadaoMergedPayload> {
  return createDomainEvent({
    type: EventType.CIDADAO_MERGED,
    aggregateId: payload.survivorId,
    payload,
    schemaVersion: 1,
    traceId,
  });
}
