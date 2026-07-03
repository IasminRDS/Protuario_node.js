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

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'] })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'])
  riskLevel!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
