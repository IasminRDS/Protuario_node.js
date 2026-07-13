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
    // Fallback 'unknown' (não req.url) para não gerar uma série por path arbitrário.
    const route = req.route?.path ?? 'unknown';

    const record = (status: number) => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      this.metrics.observe(req.method, route, status, seconds);
    };

    return next.handle().pipe(
      tap({
        next: () => record(res.statusCode),
        // No error, a exception filter ainda não fixou o status em res; lê do
        // próprio erro (HttpException.getStatus) senão 500. Sem isto, 4xx/5xx
        // eram registrados como 200 e sumiam do http_requests_errors_total.
        error: (err: unknown) => {
          const status =
            err && typeof (err as { getStatus?: unknown }).getStatus === 'function'
              ? (err as { getStatus: () => number }).getStatus()
              : ((err as { status?: number })?.status ?? 500);
          record(status);
        },
      }),
    );
  }
}
