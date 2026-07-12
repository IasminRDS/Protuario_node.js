import { Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuditoriaService } from './auditoria.service';
import { AuditChainService } from './audit-chain.service';

@ApiTags('Auditoria')
@ApiBearerAuth()
@Controller({ path: 'auditoria', version: '1' })
export class AuditoriaController {
  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly chain: AuditChainService,
  ) {}

  @Get('verify')
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Verifica a integridade da cadeia de hash (ADR-06).' })
  async verify() {
    return { data: await this.chain.verificar(), message: 'Verificação da cadeia de auditoria.' };
  }

  @Post('selar')
  @HttpCode(200)
  @RequirePermissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Sela (encadeia) os eventos de auditoria ainda sem hash.' })
  async selar() {
    return { data: await this.chain.selar(), message: 'Cadeia de auditoria selada.' };
  }

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
