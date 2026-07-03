import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePerfilDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;
}
