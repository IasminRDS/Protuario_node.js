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
