import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { AuditPrismaService } from './audit-prisma.service';
import { AuditChainService } from './audit-chain.service';

/**
 * Global: a auditoria é transversal e injetada em vários módulos (RN-045).
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditPrismaService, AuditChainService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
