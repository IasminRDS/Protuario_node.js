import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSalaDto {
  @ApiProperty({ example: 'Sala 1' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiProperty({
    example: 'geral',
    description: 'geral | ortopedia | urgencia | ...',
  })
  @IsString()
  @IsNotEmpty()
  tipo!: string;
}

export class AgendarCirurgiaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ description: 'Procedimento/tipo da cirurgia.' })
  @IsString()
  @IsNotEmpty()
  descricao!: string;

  @ApiPropertyOptional({ description: 'Cirurgião principal (Medico.id).' })
  @IsOptional()
  @IsString()
  medicoId?: string;

  @ApiPropertyOptional({ description: 'Sala cirúrgica.' })
  @IsOptional()
  @IsString()
  salaId?: string;

  @ApiPropertyOptional({ description: 'Internação vinculada.' })
  @IsOptional()
  @IsString()
  internacaoId?: string;

  @ApiPropertyOptional({ description: 'Data agendada (ISO).' })
  @IsOptional()
  @IsString()
  dataAgendada?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
