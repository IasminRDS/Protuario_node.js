import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StartEncounterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiPropertyOptional({ default: 'CONSULTA' })
  @IsOptional()
  @IsString()
  tipo?: string;
}

export class CreateNoteDto {
  @ApiProperty({ description: 'Evolução clínica (texto estruturado).' })
  @IsString()
  @IsNotEmpty()
  evolucao!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnostico?: string;
}
