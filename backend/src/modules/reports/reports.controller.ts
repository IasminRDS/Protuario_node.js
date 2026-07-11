import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AuditExportService } from '../audit/audit.service';
import { ReportsService } from './reports.service';
import { ReportExportAuditDto } from './dto/report-export-audit.dto';

/**
 * Relatórios (read-only). Todo endpoint apenas LÊ materialized views já
 * agregadas — sem lógica de negócio, sem refresh, sem query pesada em tabela.
 */
@ApiTags('Relatórios')
@ApiBearerAuth()
@RequirePermissions(Permission.REPORTS_READ)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly auditExport: AuditExportService,
  ) {}

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

  /**
   * Registra a EXPORTAÇÃO de um relatório na trilha de auditoria (LGPD). O CSV é
   * gerado no cliente a partir de dados já carregados; este endpoint fecha o
   * ciclo de rastreabilidade ("quem exportou qual relatório, quando, quantas
   * linhas"). Não retorna dados — apenas confirma o registro do evento.
   */
  @Post('export/audit')
  @HttpCode(204)
  @ApiOperation({ summary: 'Auditar exportação (client-side) de um relatório (LGPD).' })
  async auditExportRelatorio(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReportExportAuditDto,
  ): Promise<void> {
    await this.auditExport.logExport({
      tipo: 'RELATORIO',
      acao: 'EXPORTAR',
      status: 'SUCESSO',
      userId: user.id,
      // hospitalId omitido → currentHospitalId() (isolamento por tenant).
      metadata: {
        relatorio: dto.relatorio,
        formato: dto.formato ?? 'csv',
        total_registros: dto.totalRegistros ?? null,
      },
    });
  }
}
