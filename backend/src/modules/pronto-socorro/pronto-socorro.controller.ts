import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { ProntoSocorroService } from './pronto-socorro.service';
import {
  CreateAtendimentoPsDto,
  FinalizarPsDto,
} from './dto/pronto-socorro.dto';

@ApiTags('Pronto-Socorro')
@ApiBearerAuth()
@Controller({ path: 'pronto-socorro', version: '1' })
export class ProntoSocorroController {
  constructor(private readonly service: ProntoSocorroService) {}

  @Post()
  @RequirePermissions(Permission.EMERGENCY_WRITE)
  @ApiOperation({ summary: 'Registrar chegada de paciente ao PS.' })
  async chegada(
    @Body() dto: CreateAtendimentoPsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.registrarChegada(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Chegada registrada.' };
  }

  @Get('fila')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Fila do PS (aguardando + em atendimento).' })
  async fila() {
    const data = await this.service.fila();
    return { data, message: 'Fila do pronto-socorro.' };
  }

  @Get(':id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Detalhe do atendimento de PS.' })
  async buscar(@Param('id') id: string) {
    const data = await this.service.buscarPorId(id);
    return { data, message: 'Atendimento de PS.' };
  }

  @Post(':id/chamar')
  @RequirePermissions(Permission.EMERGENCY_WRITE)
  @ApiOperation({ summary: 'Chamar paciente da fila para atendimento.' })
  async chamar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.chamar(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Paciente chamado.' };
  }

  @Post(':id/finalizar')
  @RequirePermissions(Permission.EMERGENCY_WRITE)
  @ApiOperation({ summary: 'Finalizar atendimento (alta/internado/óbito).' })
  async finalizar(
    @Param('id') id: string,
    @Body() dto: FinalizarPsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.finalizar(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Atendimento finalizado.' };
  }
}
