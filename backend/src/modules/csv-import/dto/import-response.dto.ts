import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportErroDto {
  @ApiProperty({ example: 3, description: 'Número da linha no CSV (1 = cabeçalho).' })
  linha!: number;

  @ApiProperty({ example: 'CPF inválido' })
  erro!: string;
}

export class ImportPreviewDto {
  @ApiProperty()
  nome!: string;
  @ApiProperty()
  cpf!: string;
  @ApiProperty()
  dataNascimento!: string;
  @ApiPropertyOptional({ nullable: true })
  sexo!: string | null;
}

export class ImportResponseDto {
  @ApiProperty({ example: 100 })
  total!: number;

  @ApiProperty({ example: 95 })
  validos!: number;

  @ApiProperty({ example: 5 })
  invalidos!: number;

  @ApiProperty({ type: [ImportErroDto] })
  erros!: ImportErroDto[];

  @ApiProperty({
    example: true,
    description: 'true somente quando invalidos = 0 e os registros foram gravados (modo STRICT).',
  })
  sucesso!: boolean;

  @ApiProperty({ description: 'SHA-256 do arquivo enviado.' })
  fileHash!: string;

  @ApiProperty({
    type: [ImportPreviewDto],
    description: 'Primeiras linhas (preview) para conferência no frontend.',
  })
  preview!: ImportPreviewDto[];
}
