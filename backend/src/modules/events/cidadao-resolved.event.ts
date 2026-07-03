import { createDomainEvent, DomainEvent } from './base.event';
import { EventType } from './event-types';

export type MatchStrategy = 'CPF' | 'CNS' | 'HEURISTIC';

export interface CidadaoResolvedPayload extends Record<string, unknown> {
  cidadaoId: string;
  matchedBy: MatchStrategy;
}

/**
 * Emitido quando uma tentativa de cadastro é resolvida para um cidadão já
 * existente (deduplicação nacional). Serve de trilha auditável da resolução.
 */
export function cidadaoResolvedEvent(
  payload: CidadaoResolvedPayload,
  traceId?: string,
): DomainEvent<CidadaoResolvedPayload> {
  return createDomainEvent({
    type: EventType.CIDADAO_RESOLVED,
    aggregateId: payload.cidadaoId,
    payload,
    schemaVersion: 1,
    traceId,
  });
}
