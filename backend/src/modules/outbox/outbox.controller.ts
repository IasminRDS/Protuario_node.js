import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { OutboxService } from './outbox.service';

/**
 * Visibilidade operacional do Outbox (falhas deixam de ser silenciosas):
 *  - /stats: contagem por status (PENDING/PROCESSING/SENT/FAILED).
 *  - /dead-letter: eventos FAILED (esgotaram retries) para inspeção/reprocesso.
 */
@ApiTags('Outbox (operacional)')
@ApiBearerAuth()
@RequirePermissions(Permission.ADMIN_FULL)
@Controller({ path: 'outbox', version: '1' })
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Contagem de eventos por status.' })
  async stats() {
    const data = await this.outbox.countByStatus();
    return { data, message: 'Estatísticas do outbox.' };
  }

  @Get('dead-letter')
  @ApiOperation({ summary: 'Eventos FAILED (dead-letter).' })
  async deadLetter(@Query('limit') limit?: string) {
    const data = await this.outbox.listDeadLetter(
      Math.min(Number(limit) || 50, 200),
    );
    return { data, message: 'Eventos em dead-letter.' };
  }
}
