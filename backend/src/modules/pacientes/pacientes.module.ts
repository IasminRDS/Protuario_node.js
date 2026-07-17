import { Module } from '@nestjs/common';
import { PacientesController } from './pacientes.controller';
import { PacientesRepository } from './pacientes.repository';
import { PacientesService } from './pacientes.service';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { BlindIndexService } from '../../infra/crypto/blind-index';

@Module({
  controllers: [PacientesController],
  providers: [
    PacientesService,
    PacientesRepository,
    IdempotencyInterceptor,
    BlindIndexService,
  ],
  exports: [PacientesService],
})
export class PacientesModule {}
