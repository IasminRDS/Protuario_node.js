import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSetorDto {
  @ApiProperty({ example: 'Clínica Médica' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiPropertyOptional({ example: 'CM' })
  @IsOptional()
  @IsString()
  sigla?: string;

  @ApiPropertyOptional({
    enum: [
      'enfermaria',
      'uti',
      'semi_intensivo',
      'ps',
      'cirurgia',
      'recuperacao',
      'isolamento',
    ],
    default: 'enfermaria',
  })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  andar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsavel?: string;
}

export class CreateLeitoDto {
  @ApiProperty({ description: 'ID do setor.' })
  @IsString()
  @IsNotEmpty()
  setorId!: string;

  @ApiProperty({ example: '201A' })
  @IsString()
  @IsNotEmpty()
  numero!: string;

  @ApiPropertyOptional({ enum: ['comum', 'isolamento', 'uti'] })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class CreateInternacaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ description: 'Leito livre onde o paciente será internado.' })
  @IsString()
  @IsNotEmpty()
  leitoId!: string;

  @ApiPropertyOptional({ description: 'Médico responsável (Usuario.id).' })
  @IsOptional()
  @IsString()
  medicoId?: string;

  @ApiPropertyOptional({
    enum: [
      'clinica',
      'cirurgica',
      'obstetricia',
      'pediatrica',
      'psiquiatria',
      'uti',
    ],
    default: 'clinica',
  })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiProperty({ description: 'Motivo da internação.' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hipoteseDiag?: string;

  @ApiPropertyOptional({ example: 'J18.9' })
  @IsOptional()
  @IsString()
  cidPrincipal?: string;

  @ApiPropertyOptional({ description: 'Data prevista de alta (ISO).' })
  @IsOptional()
  @IsString()
  dataPrevistaAlta?: string;
}

export class CreateEvolucaoDto {
  @ApiPropertyOptional({
    enum: [
      'medica',
      'enfermagem',
      'fisioterapia',
      'nutricao',
      'psicologia',
      'servico_social',
    ],
    default: 'medica',
  })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ example: '120/80' })
  @IsOptional()
  @IsString()
  pressaoArterial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  frequenciaCardiaca?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  frequenciaResp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  saturacaoO2?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  diureseMl?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  balancoHidrico?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjetivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  objetivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avaliacao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plano?: string;
}

export class AltaDto {
  @ApiProperty({
    enum: [
      'curado',
      'melhorado',
      'transferencia',
      'obito',
      'a_pedido',
      'evasao',
    ],
  })
  @IsIn(['curado', 'melhorado', 'transferencia', 'obito', 'a_pedido', 'evasao'])
  tipoAlta!: string;

  @ApiPropertyOptional({ description: 'Sumário de alta.' })
  @IsOptional()
  @IsString()
  sumarioAlta?: string;

  @ApiPropertyOptional({ example: 'J18.9' })
  @IsOptional()
  @IsString()
  cidAlta?: string;
}
