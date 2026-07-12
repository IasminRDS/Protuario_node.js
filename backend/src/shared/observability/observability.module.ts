import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

/**
 * Observabilidade: métricas Prometheus (/metrics) globais. O MetricsInterceptor
 * é registrado como APP_INTERCEPTOR no AppModule para medir todas as rotas.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class ObservabilityModule {}
