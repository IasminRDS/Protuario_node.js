import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TransactionalOutbox } from '../../outbox/transactional-outbox';
import {
  MpiTxContext,
  MpiUnitOfWork,
} from '../application/ports/mpi-unit-of-work';
import { PrismaCidadaoRepository } from './cidadao.prisma.repository';

/**
 * Unit of Work do MPI sobre Prisma. Abre uma transação e entrega ao caso de uso
 * um repositório e um outbox ligados ao MESMO cliente transacional — garantindo
 * que agregado + evento sejam persistidos atomicamente (ou revertidos juntos).
 */
@Injectable()
export class PrismaMpiUnitOfWork implements MpiUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  execute<T>(work: (ctx: MpiTxContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => {
      const ctx: MpiTxContext = {
        cidadaoRepo: new PrismaCidadaoRepository(tx),
        outbox: new TransactionalOutbox(tx),
      };
      return work(ctx);
    });
  }
}
