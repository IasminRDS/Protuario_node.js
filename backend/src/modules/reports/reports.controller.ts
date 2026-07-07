import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { ReportsService } from './reports.service';

/**
 * Relatórios (read-only). Todo endpoint apenas LÊ materialized views já
 * agregadas — sem lógica de negócio, sem refresh, sem query pesada em tabela.
 */
@ApiTags('Relatórios')
@ApiBearerAuth()
@RequirePermissions(Permission.REPORTS_READ)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('atendimentos-por-dia')
  @ApiOperation({ summary: 'Total de atendimentos por dia (últimos 90 dias).' })
  async atendimentosPorDia() {
    const data = await this.reports.atendimentosPorDia();
    return { data, message: 'Atendimentos por dia.' };
  }

  @Get('ocupacao-leitos')
  @ApiOperation({ summary: 'Ocupação de leitos (ocupados, livres, taxa).' })
  async ocupacaoLeitos() {
    const data = await this.reports.ocupacaoLeitos();
    return { data, message: 'Ocupação de leitos.' };
  }

  @Get('tempo-medio')
  @ApiOperation({ summary: 'Tempo médio de atendimento (minutos).' })
  async tempoMedio() {
    const data = await this.reports.tempoMedio();
    return { data, message: 'Tempo médio de atendimento.' };
  }

  @Get('exames')
  @ApiOperation({ summary: 'Total de exames realizados por tipo.' })
  async exames() {
    const data = await this.reports.exames();
    return { data, message: 'Exames realizados por tipo.' };
  }
}
