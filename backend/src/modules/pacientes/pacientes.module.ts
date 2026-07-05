import { Module } from '@nestjs/common';
import { PacientesController } from './pacientes.controller';
import { PacientesRepository } from './pacientes.repository';
import { PacientesService } from './pacientes.service';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';

@Module({
  controllers: [PacientesController],
  providers: [PacientesService, PacientesRepository, IdempotencyInterceptor],
  exports: [PacientesService],
})
export class PacientesModule {}
