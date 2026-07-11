import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreateEncaminhamentoDto, RegularDto } from './dto/regulacao.dto';
import { RegulacaoService } from './regulacao.service';

@ApiTags('Regulação de vagas')
@ApiBearerAuth()
@Controller({ path: 'regulacao', version: '1' })
export class RegulacaoController {
  constructor(private readonly regulacao: RegulacaoService) {}

  @Get('fila')
  @RequirePermissions(Permission.REGULATION_READ)
  @ApiOperation({ summary: 'Fila de regulação (prioridade + ordem de chegada).' })
  async fila(
    @Query('status') status?: string,
    @Query('especialidade') especialidade?: string,
    @Query('prioridade') prioridade?: string,
  ) {
    const data = await this.regulacao.fila({ status, especialidade, prioridade });
    return { data, message: 'Fila de regulação.' };
  }

  @Post()
  @RequirePermissions(Permission.REGULATION_WRITE)
  @ApiOperation({ summary: 'Solicitar encaminhamento (entra na fila).' })
  async solicitar(
    @Body() dto: CreateEncaminhamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.regulacao.solicitar(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Encaminhamento solicitado.' };
  }

  @Patch(':id')
  @RequirePermissions(Permission.REGULATION_DECIDE)
  @ApiOperation({
    summary: 'Ação do regulador: analisar/autorizar/negar/devolver/agendar/realizar/cancelar.',
  })
  async regular(
    @Param('id') id: string,
    @Body() dto: RegularDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.regulacao.regular(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Encaminhamento atualizado.' };
  }
}
