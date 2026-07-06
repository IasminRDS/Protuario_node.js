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
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { CirurgiaService } from './cirurgia.service';
import { AgendarCirurgiaDto, CreateSalaDto } from './dto/cirurgia.dto';

@ApiTags('Centro Cirúrgico')
@ApiBearerAuth()
@Controller({ path: 'cirurgia', version: '1' })
export class CirurgiaController {
  constructor(private readonly service: CirurgiaService) {}

  @Post('salas')
  @RequirePermissions(Permission.SURGERY_WRITE)
  @ApiOperation({ summary: 'Criar sala cirúrgica.' })
  async criarSala(@Body() dto: CreateSalaDto) {
    const data = await this.service.criarSala(dto);
    return { data, message: 'Sala criada.' };
  }

  @Get('salas')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar salas cirúrgicas.' })
  async listarSalas() {
    const data = await this.service.listarSalas();
    return { data, message: 'Salas cirúrgicas.' };
  }

  @Post()
  @RequirePermissions(Permission.SURGERY_WRITE)
  @ApiOperation({ summary: 'Agendar cirurgia.' })
  async agendar(
    @Body() dto: AgendarCirurgiaDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.agendar(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Cirurgia agendada.' };
  }

  @Get()
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar cirurgias (filtro: status).' })
  async listar(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
  ) {
    const data = await this.service.listar(query, { status });
    return { data, message: 'Cirurgias.' };
  }

  @Patch(':id/iniciar')
  @RequirePermissions(Permission.SURGERY_WRITE)
  @ApiOperation({ summary: 'Iniciar cirurgia.' })
  async iniciar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.iniciar(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Cirurgia iniciada.' };
  }

  @Patch(':id/concluir')
  @RequirePermissions(Permission.SURGERY_WRITE)
  @ApiOperation({ summary: 'Concluir cirurgia.' })
  async concluir(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.concluir(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Cirurgia concluída.' };
  }

  @Patch(':id/cancelar')
  @RequirePermissions(Permission.SURGERY_WRITE)
  @ApiOperation({ summary: 'Cancelar cirurgia.' })
  async cancelar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.cancelar(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Cirurgia cancelada.' };
  }
}
