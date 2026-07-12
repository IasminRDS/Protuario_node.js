import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

/**
 * Métricas Prometheus (observabilidade — OTel-compatível via exposição
 * /metrics). Coleta métricas padrão do processo (heap, GC, event loop) +
 * histograma de latência HTTP e contador de erros por rota/status.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly httpErrors = new Counter({
    name: 'http_requests_errors_total',
    help: 'Total de respostas HTTP de erro (>=400)',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  constructor() {
    this.registry.setDefaultLabels({ app: 'snpe-api' });
    collectDefaultMetrics({ register: this.registry });
  }

  observe(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpDuration.observe(labels, seconds);
    if (status >= 400) this.httpErrors.inc(labels);
  }

  async expose(): Promise<string> {
    return this.registry.metrics();
  }
}
