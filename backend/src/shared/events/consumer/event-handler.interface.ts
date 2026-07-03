import { Prisma } from '@prisma/client';
import { DomainEvent } from '../../../modules/events/base.event';

/**
 * Modo de consumo:
 *  - CONVERGENT: estado por agregado (last-writer-wins por aggregateSeq).
 *    Tolerante a fora-de-ordem: eventos antigos são ignorados; o estado final
 *    converge para o de maior seq. Ideal para projeções/read models.
 *  - ONCE: efeito aplicado no máximo uma vez por eventId (dedup append/decisão).
 *    Ideal para efeitos não-comutativos (ex.: reconciliação de identidade).
 */
export type ConsumerMode = 'CONVERGENT' | 'ONCE';

export interface EventHandler {
  readonly consumerName: string;
  readonly mode: ConsumerMode;
  supports(type: string): boolean;
  handle(tx: Prisma.TransactionClient, event: DomainEvent): Promise<void>;
}
