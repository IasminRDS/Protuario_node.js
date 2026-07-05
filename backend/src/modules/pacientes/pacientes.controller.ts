import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { IdempotencyInterceptor } from '../../shared/interceptors/idempotency.interceptor';
import { ParseBigIntIdPipe } from '../../shared/pipes/parse-bigint-id.pipe';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { PacientesService } from './pacientes.service';

@ApiTags('Pacientes')
@ApiBearerAuth()
@Controller({ path: 'pacientes', version: '1' })
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  // Consulta liberada aos perfis assistenciais/administrativos (cap. 116).
  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Listar pacientes (paginado, filtros nome/cpf).' })
  async listar(
    @Query() query: PaginationQueryDto,
    @Query('nome') nome?: string,
    @Query('cpf') cpf?: string,
  ) {
    const data = await this.pacientesService.listar(query, { nome, cpf });
    return { data, message: 'Pacientes listados.' };
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Consultar paciente por ID (UC-12 base).' })
  async buscar(@Param('id', ParseBigIntIdPipe) id: string) {
    const data = await this.pacientesService.buscarPorId(id);
    return { data, message: 'Paciente encontrado.' };
  }

  // Cadastro/alteração: Recepção e Administrador (UC-03/UC-04).
  @Post()
  @RequirePermissions(Permission.PATIENT_CREATE)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Chave de idempotência: retries com a mesma chave fazem replay.',
  })
  @ApiOperation({ summary: 'Cadastrar paciente (UC-03).' })
  async criar(
    @Body() dto: CreatePacienteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.pacientesService.criar(dto, user.id);
    return { data, message: 'Paciente cadastrado.' };
  }

  @Put(':id')
  @RequirePermissions(Permission.PATIENT_CREATE)
  @ApiOperation({ summary: 'Atualizar cadastro do paciente (UC-04).' })
  async atualizar(
    @Param('id', ParseBigIntIdPipe) id: string,
    @Body() dto: UpdatePacienteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.pacientesService.atualizar(id, dto, user.id);
    return { data, message: 'Paciente atualizado.' };
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_CREATE)
  @ApiOperation({ summary: 'Atualização parcial do paciente.' })
  async atualizarParcial(
    @Param('id', ParseBigIntIdPipe) id: string,
    @Body() dto: UpdatePacienteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.pacientesService.atualizar(id, dto, user.id);
    return { data, message: 'Paciente atualizado.' };
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(Permission.ADMIN_FULL)
  @ApiOperation({ summary: 'Excluir paciente (exclusão lógica — RN-009).' })
  async remover(
    @Param('id', ParseBigIntIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.pacientesService.remover(id, user.id);
    return { data: null, message: 'Paciente removido (exclusão lógica).' };
  }
}
