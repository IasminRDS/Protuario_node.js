import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TerminologiaService } from './terminologia.service';

/**
 * Terminologias oficiais para autocomplete clínico. Leitura pura de catálogo
 * (sem PHI) — liberada a qualquer usuário autenticado.
 */
@ApiTags('Terminologia')
@ApiBearerAuth()
@Controller({ path: 'terminologia', version: '1' })
export class TerminologiaController {
  constructor(private readonly terminologia: TerminologiaService) {}

  @Get('cid10')
  @ApiQuery({ name: 'q', description: 'Código (prefixo) ou trecho da descrição.' })
  @ApiOperation({ summary: 'Buscar CID-10 por código ou descrição.' })
  cid10(@Query('q') q = '') {
    return { data: this.terminologia.buscarCid10(q), message: 'CID-10.' };
  }

  @Get('medicamentos')
  @ApiQuery({ name: 'q', description: 'Trecho do nome/apresentação.' })
  @ApiOperation({ summary: 'Buscar medicamentos (subconjunto RENAME).' })
  medicamentos(@Query('q') q = '') {
    return {
      data: this.terminologia.buscarMedicamentos(q),
      message: 'Medicamentos.',
    };
  }
}
