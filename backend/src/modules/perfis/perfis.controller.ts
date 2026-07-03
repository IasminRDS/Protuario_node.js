import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { PerfisService } from './perfis.service';

@ApiTags('Perfis')
@ApiBearerAuth()
@Controller({ path: 'perfis', version: '1' })
export class PerfisController {
  constructor(private readonly perfisService: PerfisService) {}

  @Get()
  @ApiOperation({ summary: 'Listar perfis de acesso.' })
  async listar() {
    const data = await this.perfisService.listar();
    return { data, message: 'Perfis listados.' };
  }

  @Post()
  @RequirePermissions(Permission.ADMIN_FULL)
  @ApiOperation({ summary: 'Criar perfil de acesso.' })
  async criar(@Body() dto: CreatePerfilDto) {
    const data = await this.perfisService.criar(dto);
    return { data, message: 'Perfil criado.' };
  }
}
