import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RawResponse } from '../../shared/decorators/raw-response.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { PdfService, PreparedPdf } from './pdf.service';

/**
 * Emissão de documentos clínicos em PDF (pdfkit — Node puro, sem browser).
 * Resposta em stream direto ao cliente; nada é salvo em disco. Cada emissão é
 * registrada em auditoria (LGPD) pelo PdfService.
 */
@ApiTags('Documentos (PDF)')
@ApiBearerAuth()
@RequirePermissions(Permission.CLINICAL_READ)
@Controller({ path: 'pdf', version: '1' })
export class PdfController {
  constructor(private readonly pdf: PdfService) {}

  @Get('paciente/:id/prontuario')
  @RawResponse()
  @ApiOperation({ summary: 'Prontuário clínico do paciente em PDF.' })
  async prontuario(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    this.stream(res, await this.pdf.prepararProntuario(id, user));
  }

  @Get('prescricao/:id')
  @RawResponse()
  @ApiOperation({ summary: 'Prescrição hospitalar em PDF.' })
  async prescricao(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    this.stream(res, await this.pdf.prepararPrescricao(id, user));
  }

  @Get('alta/:id')
  @RawResponse()
  @ApiOperation({ summary: 'Resumo de alta hospitalar em PDF.' })
  async alta(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    this.stream(res, await this.pdf.prepararAlta(id, user));
  }

  /** Cria o documento pdfkit e faz pipe direto na resposta HTTP. */
  private stream(res: Response, prepared: PreparedPdf): void {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${prepared.filename}"`,
    );
    doc.pipe(res);
    prepared.render(doc);
    doc.end();
  }
}
