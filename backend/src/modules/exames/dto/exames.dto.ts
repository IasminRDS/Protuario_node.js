import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTipoExameDto {
  @ApiProperty({ example: 'HMG' })
  @IsString()
  @IsNotEmpty()
  codigo!: string;

  @ApiProperty({ example: 'Hemograma completo' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiPropertyOptional({
    enum: ['laboratorial', 'imagem', 'funcional', 'anatomopatologico', 'outro'],
  })
  @IsOptional()
  @IsString()
  categoria?: string;

  @ApiPropertyOptional({ description: 'Preparo/instruções ao paciente.' })
  @IsOptional()
  @IsString()
  instrucoes?: string;
}

export class SolicitarExameDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ description: 'Tipo de exame (catálogo).' })
  @IsString()
  @IsNotEmpty()
  tipoExameId!: string;

  @ApiPropertyOptional({
    enum: ['rotina', 'urgente', 'urgentissimo'],
    default: 'rotina',
  })
  @IsOptional()
  @IsIn(['rotina', 'urgente', 'urgentissimo'])
  urgencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indicacaoClinica?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prontuarioId?: string;

  @ApiPropertyOptional({ description: 'Médico solicitante (Medico.id).' })
  @IsOptional()
  @IsString()
  medicoId?: string;
}

export class RegistrarResultadoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultadoTexto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultadoValor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultadoUnidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valorReferencia?: string;

  @ApiPropertyOptional({
    enum: ['normal', 'alterado', 'critico', 'indeterminado'],
  })
  @IsOptional()
  @IsIn(['normal', 'alterado', 'critico', 'indeterminado'])
  interpretacao?: string;
}
