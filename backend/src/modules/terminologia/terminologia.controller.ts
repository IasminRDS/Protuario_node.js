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

  @Get('cbo')
  @ApiQuery({ name: 'q', description: 'Código ou ocupação.' })
  @ApiOperation({ summary: 'Buscar CBO (Classificação Brasileira de Ocupações).' })
  cbo(@Query('q') q = '') {
    return { data: this.terminologia.buscarCbo(q), message: 'CBO.' };
  }

  @Get('sigtap')
  @ApiQuery({ name: 'q', description: 'Código ou procedimento.' })
  @ApiOperation({ summary: 'Buscar procedimentos SIGTAP (Tabela SUS).' })
  sigtap(@Query('q') q = '') {
    return { data: this.terminologia.buscarSigtap(q), message: 'SIGTAP.' };
  }

  @Get('cnes')
  @ApiQuery({ name: 'q', description: 'CNES, nome ou município.' })
  @ApiOperation({ summary: 'Buscar estabelecimentos de saúde (CNES).' })
  cnes(@Query('q') q = '') {
    return { data: this.terminologia.buscarCnes(q), message: 'CNES.' };
  }
}
