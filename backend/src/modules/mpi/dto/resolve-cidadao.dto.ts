import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ResolveCidadaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cns?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeMae?: string;
}
