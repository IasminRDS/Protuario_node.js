import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcquireLockDto {
  @ApiProperty({ example: 'prontuario' })
  @IsString()
  @IsNotEmpty()
  resource!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resourceId!: string;
}

export class LockIdDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lockId!: string;
}
