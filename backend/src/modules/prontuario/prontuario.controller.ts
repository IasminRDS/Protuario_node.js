import { Controller, Get, Headers, Ip, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ProntuarioService } from './prontuario.service';

@ApiTags('Prontuário')
@ApiBearerAuth()
@Controller({ path: 'prontuarios', version: '1' })
export class ProntuarioController {
  constructor(
    private readonly service: ProntuarioService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get(':pacienteId/acessos')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Quem acessou o prontuário deste paciente (transparência LGPD).' })
  async acessos(@Param('pacienteId') pacienteId: string) {
    const data = await this.service.acessos(pacienteId);
    return { data, message: 'Trilha de acessos ao prontuário.' };
  }

  @Get(':pacienteId/sumario')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({
    summary:
      'Sumário do Paciente (IPS-like): alertas, problemas ativos, medicamentos, vacinas e timeline.',
  })
  async sumario(
    @Param('pacienteId') pacienteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.sumario(pacienteId);
    // LGPD: acesso ao sumário = acesso ao prontuário (auditado com finalidade).
    await this.auditoria.registrar({
      usuarioId: user.id,
      modulo: 'PRONTUARIO',
      operacao: 'PATIENT_VIEWED',
      entity: 'paciente',
      entityId: pacienteId,
      reason: 'assistencial',
      resultado: 'SUCESSO',
      ip,
      device,
    });
    return { data, message: 'Sumário do paciente.' };
  }

  @Get(':pacienteId')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Linha do tempo clínica consolidada do paciente.' })
  async timeline(
    @Param('pacienteId') pacienteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.timeline(pacienteId);
    // LGPD: todo acesso a prontuário é auditado (com finalidade assistencial).
    await this.auditoria.registrar({
      usuarioId: user.id,
      modulo: 'PRONTUARIO',
      operacao: 'PATIENT_VIEWED',
      entity: 'paciente',
      entityId: pacienteId,
      reason: 'assistencial',
      resultado: 'SUCESSO',
      ip,
      device,
    });
    return { data, message: 'Prontuário.' };
  }
}
