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
import { CreateNoteDto, StartEncounterDto } from './dto/encounter.dto';
import { EncountersService } from './encounters.service';

@ApiTags('Atendimentos (Encounters)')
@ApiBearerAuth()
@Controller({ path: 'encounters', version: '1' })
export class EncountersController {
  constructor(private readonly service: EncountersService) {}

  private ctx(user: AuthenticatedUser, ip: string, device?: string) {
    return { actorId: user.id, ip, device };
  }

  @Post()
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  @ApiOperation({ summary: 'Iniciar atendimento (WAITING_DOCTOR → IN_CONSULTATION).' })
  async start(
    @Body() dto: StartEncounterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.start(dto, this.ctx(user, ip, device));
    return { data, message: 'Atendimento iniciado.' };
  }

  @Get()
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Listar atendimentos.' })
  async list(
    @Query('status') status?: string,
    @Query('pacienteId') pacienteId?: string,
  ) {
    const data = await this.service.list({ status, pacienteId });
    return { data, message: 'Atendimentos.' };
  }

  @Get(':id')
  @RequirePermissions(Permission.CLINICAL_READ)
  async get(@Param('id') id: string) {
    const data = await this.service.getById(id);
    return { data, message: 'Atendimento.' };
  }

  @Patch(':id/pause')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  async pause(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Ip() ip: string, @Headers('user-agent') d?: string) {
    return { data: await this.service.pause(id, this.ctx(u, ip, d)), message: 'Pausado.' };
  }

  @Patch(':id/resume')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  async resume(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Ip() ip: string, @Headers('user-agent') d?: string) {
    return { data: await this.service.resume(id, this.ctx(u, ip, d)), message: 'Retomado.' };
  }

  @Patch(':id/observe')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  @ApiOperation({ summary: 'Colocar paciente em observação.' })
  async observe(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Ip() ip: string, @Headers('user-agent') d?: string) {
    return { data: await this.service.observe(id, this.ctx(u, ip, d)), message: 'Em observação.' };
  }

  @Patch(':id/discharge')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  @ApiOperation({ summary: 'Dar alta (encerra atendimento, paciente DISCHARGED).' })
  async discharge(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Ip() ip: string, @Headers('user-agent') d?: string) {
    return { data: await this.service.discharge(id, this.ctx(u, ip, d)), message: 'Alta registrada.' };
  }

  @Patch(':id/cancel')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  async cancel(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser, @Ip() ip: string, @Headers('user-agent') d?: string) {
    return { data: await this.service.cancel(id, this.ctx(u, ip, d)), message: 'Cancelado.' };
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.ENCOUNTER_WRITE)
  @ApiOperation({ summary: 'Registrar evolução clínica (nota).' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() u: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') d?: string,
  ) {
    const data = await this.service.addNote(id, dto, this.ctx(u, ip, d));
    return { data, message: 'Evolução registrada.' };
  }
}
