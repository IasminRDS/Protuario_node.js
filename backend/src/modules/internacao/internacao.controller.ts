import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { InternacaoService } from './internacao.service';
import {
  AltaDto,
  CreateEvolucaoDto,
  CreateInternacaoDto,
  CreateLeitoDto,
  CreateSetorDto,
} from './dto/internacao.dto';

@ApiTags('Internação / Leitos')
@ApiBearerAuth()
@Controller({ path: 'internacao', version: '1' })
export class InternacaoController {
  constructor(private readonly service: InternacaoService) {}

  // --- Setores / Leitos ------------------------------------------------------

  @Post('setores')
  @RequirePermissions(Permission.INTERNMENT_WRITE)
  @ApiOperation({ summary: 'Criar setor/ala hospitalar.' })
  async criarSetor(@Body() dto: CreateSetorDto) {
    const data = await this.service.criarSetor(dto);
    return { data, message: 'Setor criado.' };
  }

  @Get('setores')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar setores com seus leitos e ocupação.' })
  async listarSetores() {
    const data = await this.service.listarSetores();
    return { data, message: 'Setores.' };
  }

  @Post('leitos')
  @RequirePermissions(Permission.INTERNMENT_WRITE)
  @ApiOperation({ summary: 'Criar leito em um setor.' })
  async criarLeito(@Body() dto: CreateLeitoDto) {
    const data = await this.service.criarLeito(dto);
    return { data, message: 'Leito criado.' };
  }

  @Get('leitos')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Mapa de leitos (filtros: status, setorId).' })
  async listarLeitos(
    @Query('status') status?: string,
    @Query('setorId') setorId?: string,
  ) {
    const data = await this.service.listarLeitos({ status, setorId });
    return { data, message: 'Leitos.' };
  }

  // --- Internação ------------------------------------------------------------

  @Post()
  @RequirePermissions(Permission.INTERNMENT_WRITE)
  @ApiOperation({ summary: 'Internar paciente em um leito livre.' })
  async internar(
    @Body() dto: CreateInternacaoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.internar(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Paciente internado.' };
  }

  @Get()
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar internações ativas (paginado).' })
  async listarAtivas(@Query() query: PaginationQueryDto) {
    const data = await this.service.listarAtivas(query);
    return { data, message: 'Internações ativas.' };
  }

  @Get(':id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Detalhe da internação com evoluções.' })
  async buscarPorId(@Param('id') id: string) {
    const data = await this.service.buscarPorId(id);
    return { data, message: 'Internação.' };
  }

  @Post(':id/evolucao')
  @RequirePermissions(Permission.INTERNMENT_WRITE)
  @ApiOperation({ summary: 'Adicionar evolução (multiprofissional).' })
  async evolucao(
    @Param('id') id: string,
    @Body() dto: CreateEvolucaoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.adicionarEvolucao(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Evolução registrada.' };
  }

  @Post(':id/alta')
  @RequirePermissions(Permission.INTERNMENT_WRITE)
  @ApiOperation({ summary: 'Dar alta e liberar o leito.' })
  async alta(
    @Param('id') id: string,
    @Body() dto: AltaDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.darAlta(id, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Alta registrada.' };
  }
}
