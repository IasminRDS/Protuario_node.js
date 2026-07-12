import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { RawResponse } from '../decorators/raw-response.decorator';
import { MetricsService } from './metrics.service';

/**
 * Endpoint de scrape do Prometheus. Público para o coletor; em produção deve
 * ficar restrito à rede interna (o Prometheus roda no mesmo cluster).
 */
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Public()
  @RawResponse() // não envelopar em JSON — formato de exposição do Prometheus
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async scrape(): Promise<string> {
    return this.metrics.expose();
  }
}
