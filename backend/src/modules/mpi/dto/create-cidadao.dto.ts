import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCidadaoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nome!: string;

  @ApiProperty({ example: '1990-05-20' })
  @IsDateString()
  dataNascimento!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cns?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  nomeMae?: string;

  @ApiPropertyOptional({ enum: ['M', 'F', 'O'] })
  @IsOptional()
  @IsIn(['M', 'F', 'O'])
  sexo?: string;
}
