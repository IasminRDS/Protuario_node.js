import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

/**
 * Global: a auditoria é transversal e injetada em vários módulos (RN-045).
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
