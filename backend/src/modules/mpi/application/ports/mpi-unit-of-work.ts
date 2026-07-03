import { CidadaoRepository } from '../../domain/cidadao.repository';
import { OutboxPort } from '../../../outbox/outbox.port';

export const MPI_UNIT_OF_WORK = Symbol('MPI_UNIT_OF_WORK');

/**
 * Contexto transacional entregue ao caso de uso: repositório e outbox ligados
 * à MESMA transação. Assim, agregado + evento são gravados atomicamente.
 */
export interface MpiTxContext {
  cidadaoRepo: CidadaoRepository;
  outbox: OutboxPort;
}

export interface MpiUnitOfWork {
  execute<T>(work: (ctx: MpiTxContext) => Promise<T>): Promise<T>;
}
