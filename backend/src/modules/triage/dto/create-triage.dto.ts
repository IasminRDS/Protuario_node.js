import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTriageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiPropertyOptional({ example: '120/80' })
  @IsOptional()
  @IsString()
  pressure?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  heartRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  oxygenSaturation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiProperty({
    enum: ['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL'],
    description:
      'Classificação de risco Manchester (cores oficiais). Valores legados LOW/MEDIUM/HIGH/EMERGENCY seguem aceitos.',
  })
  @IsIn([
    // Protocolo de Manchester (oficial)
    'VERMELHO',
    'LARANJA',
    'AMARELO',
    'VERDE',
    'AZUL',
    // Legado (compatibilidade com clientes antigos)
    'LOW',
    'MEDIUM',
    'HIGH',
    'EMERGENCY',
  ])
  riskLevel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
