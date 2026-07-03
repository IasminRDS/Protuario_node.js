import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  login!: string;

  @ApiProperty({ example: 'Admin@123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  senha!: string;
}
