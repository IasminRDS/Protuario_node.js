import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../shared/decorators/public.decorator';
import { SigningService } from '../../infra/crypto/signing.service';
import { DocumentosService } from './documentos.service';

/**
 * Verificação pública de autenticidade de documentos clínicos (destino do QR
 * impresso no PDF). Não expõe PHI — apenas metadados de emissão e o veredito
 * de integridade da assinatura.
 */
@ApiTags('Verificação de documentos')
@Public()
@Controller({ path: 'documentos', version: '1' })
export class DocumentosController {
  constructor(
    private readonly documentos: DocumentosService,
    private readonly signing: SigningService,
  ) {}

  @Get('verificar/:id')
  @ApiOperation({ summary: 'Verifica autenticidade e integridade de um documento.' })
  async verificar(@Param('id') id: string) {
    return { data: await this.documentos.verificar(id), message: 'Verificação de documento.' };
  }

  @Get('chave-publica')
  @ApiOperation({ summary: 'Chave pública (PEM) para verificação externa da assinatura.' })
  chavePublica() {
    return { data: { pem: this.signing.publicKeyPem() }, message: 'Chave pública.' };
  }
}
