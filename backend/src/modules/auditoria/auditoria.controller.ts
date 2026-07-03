import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuditoriaService } from './auditoria.service';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller({ path: 'auditoria', version: '1' })
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ) // UC-18: leitura restrita
  @ApiOperation({ summary: 'Consultar eventos de auditoria (somente leitura).' })
  async listar(
    @Query() query: PaginationQueryDto,
    @Query('modulo') modulo?: string,
    @Query('usuarioId') usuarioId?: string,
  ) {
    const data = await this.auditoriaService.listar(query, {
      modulo,
      usuarioId,
    });
    return { data, message: 'Eventos de auditoria listados.' };
  }
}
