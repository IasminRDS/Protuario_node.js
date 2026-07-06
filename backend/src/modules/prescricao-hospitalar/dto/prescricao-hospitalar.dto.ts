import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ItemPrescricaoHospDto {
  @ApiPropertyOptional({ description: 'Medicamento do catálogo (opcional).' })
  @IsOptional()
  @IsString()
  medicamentoId?: string;

  @ApiPropertyOptional({ description: 'Medicamento em texto livre.' })
  @IsOptional()
  @IsString()
  nomeLivre?: string;

  @ApiPropertyOptional({ example: '500 mg' })
  @IsOptional()
  @IsString()
  dose?: string;

  @ApiPropertyOptional({ example: 'EV' })
  @IsOptional()
  @IsString()
  via?: string;

  @ApiPropertyOptional({ example: '8/8h' })
  @IsOptional()
  @IsString()
  frequencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instrucoes?: string;
}

export class CreatePrescricaoHospDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pacienteId!: string;

  @ApiPropertyOptional({ description: 'Internação vinculada.' })
  @IsOptional()
  @IsString()
  internacaoId?: string;

  @ApiPropertyOptional({ description: 'Médico prescritor (Medico.id).' })
  @IsOptional()
  @IsString()
  medicoId?: string;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @IsInt()
  validadeHoras?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiProperty({ type: [ItemPrescricaoHospDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPrescricaoHospDto)
  itens!: ItemPrescricaoHospDto[];
}

export class AdministrarDto {
  @ApiProperty({ enum: ['realizado', 'recusado', 'atrasado'] })
  @IsIn(['realizado', 'recusado', 'atrasado'])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
