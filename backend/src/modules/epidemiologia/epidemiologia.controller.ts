import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { EpidemiologiaService } from './epidemiologia.service';

@ApiTags('Epidemiologia')
@ApiBearerAuth()
@Controller({ path: 'epidemiologia', version: '1' })
export class EpidemiologiaController {
  constructor(private readonly epi: EpidemiologiaService) {}

  @Get('resumo')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Cartões de resumo do painel epidemiológico.' })
  async resumo() {
    return { data: await this.epi.resumo(), message: 'Resumo epidemiológico.' };
  }

  @Get('notificacoes-por-agravo')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Notificações compulsórias por agravo no período.' })
  async porAgravo(@Query('dias') dias?: string) {
    const data = await this.epi.notificacoesPorAgravo(this.parseDias(dias, 30));
    return { data, message: 'Notificações por agravo.' };
  }

  @Get('notificacoes-por-municipio')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Notificações por município de residência.' })
  async porMunicipio(@Query('dias') dias?: string) {
    const data = await this.epi.notificacoesPorMunicipio(this.parseDias(dias, 30));
    return { data, message: 'Notificações por município.' };
  }

  @Get('ocupacao-leitos')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Ocupação de leitos por setor.' })
  async leitos() {
    return { data: await this.epi.ocupacaoLeitos(), message: 'Ocupação de leitos.' };
  }

  @Get('fila-regulacao')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Fila de regulação por status e prioridade.' })
  async regulacao() {
    return { data: await this.epi.filaRegulacao(), message: 'Fila de regulação.' };
  }

  @Get('triagem-manchester')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Distribuição da classificação de risco no período.' })
  async manchester(@Query('dias') dias?: string) {
    const data = await this.epi.triagemManchester(this.parseDias(dias, 7));
    return { data, message: 'Distribuição Manchester.' };
  }

  private parseDias(raw: string | undefined, padrao: number): number {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 365 ? Math.floor(n) : padrao;
  }
}
