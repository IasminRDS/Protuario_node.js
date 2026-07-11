import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Relatórios são renderizados no cliente e exportados como CSV a partir de dados
 * já carregados. Para fechar a trilha LGPD ("quem exportou qual relatório e
 * quando"), o cliente registra o evento de EXPORTAÇÃO por este endpoint. O
 * `relatorio` é restrito a um catálogo fechado (sem texto livre na auditoria).
 */
export const RELATORIOS = [
  'atendimentos-por-dia',
  'exames-realizados',
  'ocupacao-leitos',
  'tempo-medio',
] as const;

export type RelatorioTipo = (typeof RELATORIOS)[number];

export class ReportExportAuditDto {
  @ApiProperty({ enum: RELATORIOS, description: 'Relatório exportado (catálogo fechado).' })
  @IsIn(RELATORIOS as unknown as string[])
  relatorio!: RelatorioTipo;

  @ApiPropertyOptional({ enum: ['csv'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv'])
  formato?: 'csv';

  @ApiPropertyOptional({ description: 'Quantidade de linhas exportadas.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  totalRegistros?: number;
}
