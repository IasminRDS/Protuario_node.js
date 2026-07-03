import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePacienteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  nome!: string;

  @ApiPropertyOptional({ description: 'CPF (somente dígitos ou formatado).' })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional({ description: 'Cartão Nacional de Saúde.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  cns?: string;

  @ApiProperty({ enum: ['M', 'F', 'O'] })
  @IsIn(['M', 'F', 'O'])
  sexo!: string;

  @ApiProperty({ example: '1990-05-20', description: 'Data de nascimento (ISO).' })
  @IsDateString()
  dataNascimento!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9()+\-\s]{8,20}$/, { message: 'Telefone inválido.' })
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endereco?: string;
}
