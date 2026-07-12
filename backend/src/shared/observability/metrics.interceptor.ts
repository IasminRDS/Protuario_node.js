import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/** Mede a latência de cada requisição e alimenta o histograma Prometheus. */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const started = process.hrtime.bigint();

    // Usa o padrão da rota (ex.: /pacientes/:id) para não explodir a cardinalidade.
    const route =
      req.route?.path ?? (req.url as string)?.split('?')[0] ?? 'unknown';

    const record = () => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      this.metrics.observe(req.method, route, res.statusCode, seconds);
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
