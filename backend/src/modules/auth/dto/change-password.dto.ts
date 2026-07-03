import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senhaAtual!: string;

  @ApiProperty({
    description:
      'Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo (cap. 118).',
  })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s])/, {
    message:
      'A senha deve conter maiúscula, minúscula, número e caractere especial.',
  })
  novaSenha!: string;
}
