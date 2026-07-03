import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  login!: string;

  @ApiProperty({
    description: 'Senha forte (cap. 118): 8+ com maiúscula, minúscula, número e símbolo.',
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])/, {
    message:
      'A senha deve conter maiúscula, minúscula, número e caractere especial.',
  })
  senha!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiProperty({ description: 'ID do perfil de acesso (RN-002).' })
  @IsString()
  @IsNotEmpty()
  perfilId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
