import { ApiProperty } from '@nestjs/swagger';

export class AtendimentoPorDiaDto {
  @ApiProperty({ example: '2026-07-07', description: 'Dia (YYYY-MM-DD).' })
  dia!: string;

  @ApiProperty({ example: 42 })
  totalAtendimentos!: number;

  @ApiProperty({ nullable: true, description: 'Instante do último refresh da view.' })
  atualizadoEm!: string | null;
}

export class OcupacaoLeitosDto {
  @ApiProperty({ example: 8 })
  ocupados!: number;

  @ApiProperty({ example: 4 })
  livres!: number;

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 66.67, description: 'Percentual de ocupação.' })
  taxaOcupacao!: number;

  @ApiProperty({ nullable: true })
  atualizadoEm!: string | null;
}

export class TempoMedioDto {
  @ApiProperty({ example: 120 })
  totalAtendimentos!: number;

  @ApiProperty({ example: 37.5, description: 'Tempo médio de atendimento (minutos).' })
  mediaMinutos!: number;

  @ApiProperty({ nullable: true })
  atualizadoEm!: string | null;
}

export class ExameRealizadoDto {
  @ApiProperty({ example: 'HMG' })
  codigo!: string;

  @ApiProperty({ example: 'Hemograma completo' })
  tipoExame!: string;

  @ApiProperty({ example: 87 })
  total!: number;

  @ApiProperty({ nullable: true })
  atualizadoEm!: string | null;
}
