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
import { AGRAVOS_NOTIFICAVEIS } from './agravos.catalog';
import {
  CreateNotificacaoManualDto,
  ResolverNotificacaoDto,
} from './dto/vigilancia.dto';
import { VigilanciaService } from './vigilancia.service';

@ApiTags('Vigilância epidemiológica')
@ApiBearerAuth()
@Controller({ path: 'vigilancia', version: '1' })
export class VigilanciaController {
  constructor(private readonly vigilancia: VigilanciaService) {}

  @Get('notificacoes')
  @RequirePermissions(Permission.SURVEILLANCE_READ)
  @ApiOperation({ summary: 'Fila de notificações compulsórias (SINAN).' })
  async list(@Query('status') status?: string) {
    const data = await this.vigilancia.list(status);
    return { data, message: 'Notificações compulsórias.' };
  }

  @Get('agravos')
  @RequirePermissions(Permission.SURVEILLANCE_READ)
  @ApiOperation({ summary: 'Catálogo de agravos notificáveis (lista nacional).' })
  agravos() {
    return { data: AGRAVOS_NOTIFICAVEIS, message: 'Agravos notificáveis.' };
  }

  @Post('notificacoes')
  @RequirePermissions(Permission.SURVEILLANCE_WRITE)
  @ApiOperation({ summary: 'Abrir ficha de notificação manualmente.' })
  async criar(
    @Body() dto: CreateNotificacaoManualDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.vigilancia.criarManual(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Notificação registrada.' };
  }

  @Patch('notificacoes/:id')
  @RequirePermissions(Permission.SURVEILLANCE_WRITE)
  @ApiOperation({ summary: 'Resolver ficha: ENVIAR à vigilância ou DESCARTAR.' })
  async resolver(
    @Param('id') id: string,
    @Body() dto: ResolverNotificacaoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.vigilancia.resolver(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Notificação resolvida.' };
  }
}
