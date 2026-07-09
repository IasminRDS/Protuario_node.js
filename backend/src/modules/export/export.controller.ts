import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RawResponse } from '../../shared/decorators/raw-response.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { PerfilNome } from '../../shared/enums/perfil.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { ExportService, type ExportFormat } from './export.service';

/**
 * Exportação tenant-safe de dados. Liberado a ADMIN (Administrador) e RECEPÇÃO
 * — perfis com acesso a cadastro. Nega perfis clínicos/gestão sem mandato de
 * export de PII em massa. O isolamento por hospital é garantido no service.
 */
@ApiTags('Exportação')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(PerfilNome.ADMINISTRADOR, PerfilNome.RECEPCAO)
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get('pacientes')
  @RawResponse()
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'json'] })
  @ApiOperation({
    summary: 'Exportar pacientes do hospital (tenant-safe) em CSV ou JSON (stream).',
  })
  async pacientes(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('format') format?: string,
  ): Promise<void> {
    if (format && format !== 'csv' && format !== 'json') {
      throw new BadRequestException('Parâmetro "format" inválido (use csv ou json).');
    }
    const fmt: ExportFormat = format === 'json' ? 'json' : 'csv';
    await this.service.streamPacientesExport(user, fmt, res);
  }
}
