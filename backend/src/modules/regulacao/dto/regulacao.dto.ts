import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEncaminhamentoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ example: 'Cardiologia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  especialidade!: string;

  @ApiProperty({ enum: ['eletivo', 'urgencia', 'emergencia'] })
  @IsIn(['eletivo', 'urgencia', 'emergencia'])
  prioridade!: string;

  @ApiProperty({ description: 'Justificativa clínica do encaminhamento.' })
  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hipoteseDiagnostica?: string;

  @ApiPropertyOptional({ example: 'I20.0' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  cid?: string;

  @ApiPropertyOptional({ description: 'Serviço/unidade de destino sugerido.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  servicoDestino?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export const ACOES_REGULACAO = [
  'analisar', // solicitado → em_analise
  'autorizar', // solicitado|em_analise → autorizado
  'negar', // solicitado|em_analise → negado (parecer obrigatório)
  'devolver', // solicitado|em_analise → devolvido (parecer obrigatório)
  'agendar', // autorizado → agendado (dataAgendada obrigatória)
  'realizar', // agendado → realizado
  'cancelar', // qualquer não-final → cancelado
] as const;
export type AcaoRegulacao = (typeof ACOES_REGULACAO)[number];

export class RegularDto {
  @ApiProperty({ enum: ACOES_REGULACAO })
  @IsIn(ACOES_REGULACAO as unknown as string[])
  acao!: AcaoRegulacao;

  @ApiPropertyOptional({ description: 'Parecer do médico regulador.' })
  @IsOptional()
  @IsString()
  parecer?: string;

  @ApiPropertyOptional({ description: 'Unidade executante definida na regulação.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  unidadeDestino?: string;

  @ApiPropertyOptional({ description: 'Data/hora agendada (ação agendar).' })
  @IsOptional()
  @IsDateString()
  dataAgendada?: string;
}
