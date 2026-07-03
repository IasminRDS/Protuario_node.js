import { Body, Controller, Get, Headers, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { PrescriptionsService } from './prescriptions.service';

@ApiTags('Prescrições')
@ApiBearerAuth()
@Controller({ path: 'prescriptions', version: '1' })
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Post()
  @RequirePermissions(Permission.PRESCRIPTION_WRITE)
  @ApiOperation({ summary: 'Emitir prescrição médica.' })
  async create(
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.service.create(dto, { actorId: user.id, ip, device });
    return { data, message: 'Prescrição emitida.' };
  }

  @Get('atendimento/:id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Prescrições de um atendimento.' })
  async list(@Param('id') id: string) {
    const data = await this.service.listByAtendimento(id);
    return { data, message: 'Prescrições.' };
  }
}
