import { Module } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxModule } from '../outbox/outbox.module';
import { CreateCidadaoUseCase } from './application/create-cidadao.usecase';
import { ResolveCidadaoUseCase } from './application/resolve-cidadao.usecase';
import { MPI_UNIT_OF_WORK } from './application/ports/mpi-unit-of-work';
import { MpiController } from './controllers/mpi.controller';
import { ReconcileIdentityHandler } from './consumers/reconcile-identity.handler';
import { CIDADAO_REPOSITORY } from './domain/cidadao.repository';
import { PrismaCidadaoRepository } from './infrastructure/cidadao.prisma.repository';
import { PrismaMpiUnitOfWork } from './infrastructure/prisma-mpi.unit-of-work';

/**
 * Bounded context MPI (Master Patient Index) — primeiro núcleo produtivo do SNPE.
 * Camadas: controllers -> application (use cases) -> domain (regras/portas)
 * <- infrastructure (Prisma). Escrita atômica via Unit of Work + Outbox.
 */
@Module({
  imports: [OutboxModule],
  controllers: [MpiController],
  providers: [
    CreateCidadaoUseCase,
    ResolveCidadaoUseCase,
    ReconcileIdentityHandler, // registra-se no EventHandlerRegistry (onModuleInit)
    { provide: MPI_UNIT_OF_WORK, useClass: PrismaMpiUnitOfWork },
    // Repositório para LEITURA (fora de transação), ligado à instância base.
    {
      provide: CIDADAO_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) =>
        new PrismaCidadaoRepository(prisma),
    },
  ],
})
export class MpiModule {}
