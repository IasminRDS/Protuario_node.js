import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AcquireLockDto, LockIdDto } from './dto/lock.dto';
import { LocksService } from './locks.service';

@ApiTags('Locks (concorrência)')
@ApiBearerAuth()
@Controller({ path: 'locks', version: '1' })
export class LocksController {
  constructor(private readonly service: LocksService) {}

  @Post('acquire')
  @HttpCode(200)
  @ApiOperation({ summary: 'Adquirir lock de edição (soft-lock, TTL 30s).' })
  async acquire(
    @Body() dto: AcquireLockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.acquire(dto.resource, dto.resourceId, {
      id: user.id,
      login: user.login,
    });
    return { data, message: 'Lock.' };
  }

  @Post('heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar o lock (heartbeat obrigatório).' })
  async heartbeat(@Body() dto: LockIdDto, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.heartbeat(dto.lockId, {
      id: user.id,
      login: user.login,
    });
    return { data, message: 'Renovado.' };
  }

  @Post('release')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liberar o lock.' })
  async release(@Body() dto: LockIdDto, @CurrentUser() user: AuthenticatedUser) {
    const data = await this.service.release(dto.lockId, {
      id: user.id,
      login: user.login,
    });
    return { data, message: 'Liberado.' };
  }

  @Get(':resource/:resourceId')
  @ApiOperation({ summary: 'Detentor atual do lock (ou null).' })
  async holder(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
  ) {
    const data = await this.service.holder(resource, resourceId);
    return { data, message: 'Detentor do lock.' };
  }
}
