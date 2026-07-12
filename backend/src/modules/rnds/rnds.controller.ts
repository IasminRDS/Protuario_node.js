import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { RndsService, type TipoEnvioRnds } from './rnds.service';

class EnviarRndsDto {
  @IsIn(['RAC', 'RIA', 'RESULTADO_EXAME'])
  tipo!: TipoEnvioRnds;

  @IsString()
  @IsNotEmpty()
  entityId!: string;
}

@ApiTags('Interoperabilidade RNDS')
@ApiBearerAuth()
@Controller({ path: 'rnds', version: '1' })
export class RndsController {
  constructor(private readonly rnds: RndsService) {}

  @Get('envios')
  @RequirePermissions(Permission.REPORTS_READ)
  @ApiOperation({ summary: 'Fila de envios à RNDS com status por registro.' })
  async envios(@Query('status') status?: string) {
    return { data: await this.rnds.listar(status), message: 'Envios RNDS.' };
  }

  @Get('preview/:tipo/:entityId')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Pré-visualiza o bundle FHIR que seria enviado.' })
  async preview(
    @Param('tipo') tipo: TipoEnvioRnds,
    @Param('entityId') entityId: string,
  ) {
    const { recurso } = await this.rnds.montarRecurso(tipo, entityId);
    return { data: recurso, message: 'Bundle FHIR (preview).' };
  }

  @Post('enviar')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Constrói e envia um registro clínico à RNDS.' })
  async enviar(@Body() dto: EnviarRndsDto) {
    const data = await this.rnds.enviar(dto.tipo, dto.entityId);
    return { data, message: 'Registro enviado à RNDS.' };
  }

  @Post('envios/:id/reenviar')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Reenvia um registro (após erro ou atualização).' })
  async reenviar(@Param('id') id: string) {
    const data = await this.rnds.reenviar(id);
    return { data, message: 'Reenvio efetuado.' };
  }
}
