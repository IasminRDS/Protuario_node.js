import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { HospitalsService } from './hospitals.service';

class CreateHospitalDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cnes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;
}

@ApiTags('Hospitais (tenants)')
@ApiBearerAuth()
@RequirePermissions(Permission.HOSPITAL_MANAGE)
@Controller({ path: 'hospitals', version: '1' })
export class HospitalsController {
  constructor(private readonly service: HospitalsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar hospitais (tenants).' })
  async list() {
    return { data: await this.service.list(), message: 'Hospitais.' };
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar hospital (tenant).' })
  async create(@Body() dto: CreateHospitalDto) {
    return { data: await this.service.create(dto), message: 'Hospital criado.' };
  }
}
