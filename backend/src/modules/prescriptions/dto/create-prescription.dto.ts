import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePrescriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  atendimentoId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  medication!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
