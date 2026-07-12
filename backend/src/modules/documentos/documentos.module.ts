import { Global, Module } from '@nestjs/common';
import { SigningService } from '../../infra/crypto/signing.service';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';

/**
 * Global: o PdfModule injeta DocumentosService/SigningService para assinar os
 * documentos no momento da emissão.
 */
@Global()
@Module({
  controllers: [DocumentosController],
  providers: [SigningService, DocumentosService],
  exports: [SigningService, DocumentosService],
})
export class DocumentosModule {}
