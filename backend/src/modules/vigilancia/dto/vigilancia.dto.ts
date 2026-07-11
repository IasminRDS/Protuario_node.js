import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNotificacaoManualDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiProperty({ example: 'A90' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  cid!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class ResolverNotificacaoDto {
  @ApiProperty({ enum: ['ENVIAR', 'DESCARTAR'] })
  @IsIn(['ENVIAR', 'DESCARTAR'])
  acao!: 'ENVIAR' | 'DESCARTAR';

  /** Obrigatório ao descartar (justificativa do falso positivo). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;
}
