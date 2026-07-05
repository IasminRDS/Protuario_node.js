import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
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
  @MaxLength(20)
  cnes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;
}

class UpdateHospitalDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

// Gestão de tenants: exclusiva do SUPER_ADMIN (HOSPITAL_MANAGE).
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

  @Get(':id')
  @ApiOperation({ summary: 'Consultar hospital por ID.' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return { data: await this.service.findById(id), message: 'Hospital.' };
  }

  @Post()
  @ApiOperation({ summary: 'Cadastrar hospital (tenant).' })
  async create(@Body() dto: CreateHospitalDto) {
    return { data: await this.service.create(dto), message: 'Hospital criado.' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar hospital.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return {
      data: await this.service.update(id, dto),
      message: 'Hospital atualizado.',
    };
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Desativar hospital (exclusão lógica — preserva histórico).' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.deactivate(id);
    return { data: null, message: 'Hospital desativado.' };
  }
}
