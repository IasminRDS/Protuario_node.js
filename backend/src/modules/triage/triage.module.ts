import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { TriageController } from './triage.controller';
import { TriageService } from './triage.service';

@Module({
  controllers: [TriageController],
  providers: [TriageService, IdempotencyInterceptor],
})
export class TriageModule {}
