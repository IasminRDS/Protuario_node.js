import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAtendimentoPsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ description: 'Motivo da procura ao PS.' })
  @IsString()
  @IsNotEmpty()
  motivoConsulta!: string;

  @ApiPropertyOptional({ description: 'Triagem associada, se houver.' })
  @IsOptional()
  @IsString()
  triagemId?: string;
}

export class FinalizarPsDto {
  @ApiProperty({ enum: ['alta', 'internado', 'obito'] })
  @IsIn(['alta', 'internado', 'obito'])
  desfecho!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosticoPreliminar?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conduta?: string;
}
