import { Controller, Get, Header } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { RawResponse } from '../../shared/decorators/raw-response.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { ConsistencyMonitorService } from './consistency-monitor.service';

/**
 * F0.6-B — endpoints internos de verificação de consistência (on-demand).
 * Restrito a ADMIN_FULL (produção: usar service token / rede interna).
 */
@ApiTags('Consistência (interno)')
@ApiBearerAuth()
@RequirePermissions(Permission.ADMIN_FULL)
@Controller({ path: 'internal/consistency', version: '1' })
export class ConsistencyMonitorController {
  constructor(private readonly monitor: ConsistencyMonitorService) {}

  @Get('health')
  @ApiOperation({ summary: 'Verificação rápida de invariantes (runAll).' })
  async health() {
    const report = await this.monitor.runAll();
    return { data: report, message: report.ok ? 'Consistente.' : 'VIOLAÇÃO detectada.' };
  }

  @Get('report')
  @ApiOperation({ summary: 'Relatório completo de invariantes.' })
  async report() {
    return { data: await this.monitor.runAll(), message: 'Relatório de consistência.' };
  }

  /**
   * F0.6-C — métricas Prometheus (text format). @Public para scrape sem JWT —
   * em produção restringir por rede (só o Prometheus alcança este endpoint).
   */
  @Public()
  @RequirePermissions() // vazio → sobrescreve o ADMIN_FULL da classe (scrape sem JWT)
  @RawResponse()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Métricas de consistência (Prometheus).' })
  metrics() {
    return this.monitor.toPrometheus();
  }
}
