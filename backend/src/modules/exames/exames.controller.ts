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
import { ExamesService } from './exames.service';
import {
  CreateTipoExameDto,
  RegistrarResultadoDto,
  SolicitarExameDto,
} from './dto/exames.dto';

@ApiTags('Exames')
@ApiBearerAuth()
@Controller({ path: 'exames', version: '1' })
export class ExamesController {
  constructor(private readonly service: ExamesService) {}

  @Post('tipos')
  @RequirePermissions(Permission.EXAM_WRITE)
  @ApiOperation({ summary: 'Cadastrar tipo de exame (catálogo).' })
  async criarTipo(@Body() dto: CreateTipoExameDto) {
    const data = await this.service.criarTipo(dto);
    return { data, message: 'Tipo de exame cadastrado.' };
  }

  @Get('tipos')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar catálogo de tipos de exame.' })
  async listarTipos() {
    const data = await this.service.listarTipos();
    return { data, message: 'Catálogo de exames.' };
  }

  @Post()
  @RequirePermissions(Permission.EXAM_WRITE)
  @ApiOperation({ summary: 'Solicitar exame para um paciente.' })
  async solicitar(
    @Body() dto: SolicitarExameDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.solicitar(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Exame solicitado.' };
  }

  @Get()
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar exames (filtros: status, pacienteId).' })
  async listar(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('pacienteId') pacienteId?: string,
  ) {
    const data = await this.service.listar(query, { status, pacienteId });
    return { data, message: 'Exames.' };
  }

  @Get('paciente/:id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Exames de um paciente.' })
  async porPaciente(@Param('id') id: string) {
    const data = await this.service.listarPorPaciente(id);
    return { data, message: 'Exames do paciente.' };
  }

  @Patch(':id/coleta')
  @RequirePermissions(Permission.EXAM_WRITE)
  @ApiOperation({ summary: 'Marcar exame como coletado.' })
  async coleta(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.marcarColeta(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Coleta registrada.' };
  }

  @Patch(':id/resultado')
  @RequirePermissions(Permission.EXAM_WRITE)
  @ApiOperation({ summary: 'Registrar resultado do exame.' })
  async resultado(
    @Param('id') id: string,
    @Body() dto: RegistrarResultadoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.registrarResultado(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Resultado registrado.' };
  }
}
