import { Body, Controller, Get, Headers, Ip, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CreateTriageDto } from './dto/create-triage.dto';
import { TriageService } from './triage.service';

@ApiTags('Triagem')
@ApiBearerAuth()
@Controller({ path: 'triage', version: '1' })
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Post()
  @RequirePermissions(Permission.TRIAGE_WRITE)
  @ApiOperation({ summary: 'Registrar triagem e avançar o fluxo do paciente.' })
  async create(
    @Body() dto: CreateTriageDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') device?: string,
  ) {
    const data = await this.triageService.create(dto, {
      actorId: user.id,
      ip,
      device,
    });
    return { data, message: 'Triagem registrada.' };
  }

  @Get('paciente/:id')
  @RequirePermissions(Permission.CLINICAL_READ)
  @ApiOperation({ summary: 'Triagens de um paciente.' })
  async list(@Param('id') id: string) {
    const data = await this.triageService.listByPaciente(id);
    return { data, message: 'Triagens do paciente.' };
  }
}
