import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';

/**
 * Query da listagem de pacientes: paginação + filtros nome/cpf. Precisa declarar
 * nome/cpf porque o ValidationPipe global usa forbidNonWhitelisted — parâmetros
 * não declarados no DTO são rejeitados com 400 (por isso os filtros falhavam).
 */
export class ListPacientesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtro por nome (contém, case-insensitive).' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtro por CPF.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;
}
