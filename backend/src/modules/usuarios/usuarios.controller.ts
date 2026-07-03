import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

// UC-02: gestão de usuários é exclusiva do Administrador (admin:full).
@ApiTags('Usuários')
@ApiBearerAuth()
@RequirePermissions(Permission.ADMIN_FULL)
@Controller({ path: 'usuarios', version: '1' })
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuários (paginado).' })
  async listar(
    @Query() query: PaginationQueryDto,
    @Query('nome') nome?: string,
    @Query('ativo') ativo?: string,
  ) {
    const data = await this.usuariosService.listar(query, { nome, ativo });
    return { data, message: 'Usuários listados.' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar usuário por ID.' })
  async buscar(@Param('id') id: string) {
    const data = await this.usuariosService.buscarPorId(id);
    return { data, message: 'Usuário encontrado.' };
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar usuário (UC-02).' })
  async criar(
    @Body() dto: CreateUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.usuariosService.criar(dto, user.id);
    return { data, message: 'Usuário cadastrado.' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar cadastro de usuário.' })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.usuariosService.atualizar(id, dto, user.id);
    return { data, message: 'Usuário atualizado.' };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Excluir usuário (exclusão lógica — RN-005).' })
  async remover(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.usuariosService.remover(id, user.id);
    return { data: null, message: 'Usuário removido (exclusão lógica).' };
  }
}
