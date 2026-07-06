import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { PrescricaoHospitalarService } from './prescricao-hospitalar.service';
import {
  AdministrarDto,
  CreatePrescricaoHospDto,
} from './dto/prescricao-hospitalar.dto';

@ApiTags('Prescrição Hospitalar')
@ApiBearerAuth()
@Controller({ path: 'prescricao-hospitalar', version: '1' })
export class PrescricaoHospitalarController {
  constructor(private readonly service: PrescricaoHospitalarService) {}

  @Post()
  @RequirePermissions(Permission.PRESCRIPTION_WRITE)
  @ApiOperation({ summary: 'Criar prescrição hospitalar com itens.' })
  async criar(
    @Body() dto: CreatePrescricaoHospDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.criar(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Prescrição hospitalar criada.' };
  }

  @Get('paciente/:id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Prescrições hospitalares de um paciente.' })
  async porPaciente(@Param('id') id: string) {
    const data = await this.service.listarPorPaciente(id);
    return { data, message: 'Prescrições do paciente.' };
  }

  @Get('internacao/:id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Prescrições hospitalares de uma internação.' })
  async porInternacao(@Param('id') id: string) {
    const data = await this.service.listarPorInternacao(id);
    return { data, message: 'Prescrições da internação.' };
  }

  @Post('item/:itemId/administrar')
  @RequirePermissions(Permission.MED_ADMIN_WRITE)
  @ApiOperation({
    summary: 'Registrar administração de medicação (enfermagem).',
  })
  async administrar(
    @Param('itemId') itemId: string,
    @Body() dto: AdministrarDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.administrar(itemId, dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Administração registrada.' };
  }

  @Post(':id/suspender')
  @RequirePermissions(Permission.PRESCRIPTION_WRITE)
  @ApiOperation({ summary: 'Suspender prescrição hospitalar.' })
  async suspender(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.suspender(id, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Prescrição suspensa.' };
  }
}
