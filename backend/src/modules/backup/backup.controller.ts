import {
  Controller,
  HttpCode,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RawResponse } from '../../shared/decorators/raw-response.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { MfaGuard } from '../../shared/guards/mfa.guard';
import { PerfilNome } from '../../shared/enums/perfil.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { BackupService, type BackupFormat } from './backup.service';

/**
 * Backup do banco. Restrito ao SuperAdmin (operador da plataforma): pg_dump é
 * GLOBAL (todos os hospitais), então NÃO pode ser exposto a admins de hospital.
 * A checagem é por PERFIL (@Roles) — não por permissão, pois ADMIN_FULL (que o
 * Administrador de hospital possui) burlaria uma checagem por permissão.
 */
@ApiTags('Backup')
@ApiBearerAuth()
@UseGuards(RolesGuard, MfaGuard) // MFA step-up: backup global exige sessão verificada
@Roles(PerfilNome.SUPER_ADMIN)
@Controller({ path: 'backup', version: '1' })
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Post()
  @HttpCode(200)
  @RawResponse()
  // Backup é operação pesada e global: janela bem mais restrita que o export.
  @Throttle({
    default: {
      limit: Number(process.env.BACKUP_THROTTLE_LIMIT ?? 3),
      ttl: Number(process.env.BACKUP_THROTTLE_TTL_MS ?? 300_000),
    },
  })
  @ApiQuery({ name: 'format', required: false, enum: ['sql', 'dump'] })
  @ApiOperation({
    summary: 'Gerar backup lógico do banco (pg_dump) em stream. Somente SuperAdmin.',
  })
  backup(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('format') format?: string,
  ): void {
    const fmt: BackupFormat = format === 'dump' ? 'dump' : 'sql';
    this.service.stream(res, user, fmt);
  }
}
