import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({ description: 'Token do desafio recebido no login.' })
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Código MFA deve ter 6 dígitos.' })
  code!: string;
}

export class MfaCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Código MFA deve ter 6 dígitos.' })
  code!: string;
}
