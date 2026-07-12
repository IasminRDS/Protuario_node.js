import { Body, Controller, Get, HttpCode, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { LgpdService } from './lgpd.service';

class ConsentimentoDto {
  @IsString()
  @IsNotEmpty()
  finalidade!: string;

  @IsOptional()
  @IsString()
  pacienteId?: string;
}

class BreakGlassDto {
  @IsString()
  @IsNotEmpty()
  justificativa!: string;
}

@ApiTags('LGPD')
@ApiBearerAuth()
@Controller({ path: 'lgpd', version: '1' })
export class LgpdController {
  constructor(private readonly lgpd: LgpdService) {}

  @Get('retencao')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Relatório de retenção legal (CFM 1.821/2007) e elegibilidade a expurgo.' })
  async retencao() {
    return { data: await this.lgpd.relatorioRetencao(), message: 'Retenção legal.' };
  }

  @Get('consentimento/status')
  @ApiOperation({ summary: 'Consentimento vigente do usuário atual.' })
  async status(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.lgpd.statusConsentimento(user.id), message: 'Status do consentimento.' };
  }

  @Post('consentimento')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registra o aceite do termo de consentimento (LGPD).' })
  async consentir(
    @Body() dto: ConsentimentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    const data = await this.lgpd.registrarConsentimento(dto, { actorId: user.id, ip });
    return { data, message: 'Consentimento registrado.' };
  }

  @Post('break-the-glass/:pacienteId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Acesso de emergência a prontuário mediante justificativa.' })
  async breakGlass(
    @Param('pacienteId') pacienteId: string,
    @Body() dto: BreakGlassDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
  ) {
    const data = await this.lgpd.breakTheGlass(pacienteId, dto.justificativa, {
      actorId: user.id,
      ip,
    });
    return { data, message: 'Acesso de emergência registrado.' };
  }
}
