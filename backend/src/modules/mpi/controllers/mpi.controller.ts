import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { RequirePermissions } from '../../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../../shared/rbac/permissions';
import { getTraceId } from '../../../shared/observability/trace-id.middleware';
import { CreateCidadaoUseCase } from '../application/create-cidadao.usecase';
import { ResolveCidadaoUseCase } from '../application/resolve-cidadao.usecase';
import { CreateCidadaoDto } from '../dto/create-cidadao.dto';
import { ResolveCidadaoDto } from '../dto/resolve-cidadao.dto';

@ApiTags('MPI — Identidade do Cidadão')
@ApiBearerAuth()
@Controller({ path: 'mpi/cidadaos', version: '1' })
export class MpiController {
  constructor(
    private readonly createCidadao: CreateCidadaoUseCase,
    private readonly resolveCidadao: ResolveCidadaoUseCase,
  ) {}

  @Post()
  @RequirePermissions(Permission.PATIENT_CREATE)
  @ApiOperation({
    summary:
      'Registrar cidadão (identidade nacional). Deduplica por CPF/CNS/heurística e emite evento via Outbox.',
  })
  async criar(@Body() dto: CreateCidadaoDto, @Req() req: Request) {
    const result = await this.createCidadao.execute({
      ...dto,
      traceId: getTraceId(req),
    });
    return {
      data: result,
      message: result.resolved
        ? 'Cidadão já existente — resolvido por deduplicação.'
        : 'Cidadão registrado.',
    };
  }

  @Get('resolve')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({
    summary: 'Resolver identidade nacional (leitura) por CPF/CNS/heurística.',
  })
  async resolver(@Query() query: ResolveCidadaoDto) {
    const data = await this.resolveCidadao.execute(query);
    return { data, message: 'Resolução concluída.' };
  }
}
