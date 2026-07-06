import {
  assinatura,
  cabecalho,
  fmtDataHora,
  kv,
  MedicoAssinante,
  pacienteBlock,
  PacientePdf,
  paragrafo,
  PdfMeta,
  rodape,
  secao,
} from './layout';

export interface PrescricaoItemPdf {
  nome: string;
  dose?: string | null;
  via?: string | null;
  frequencia?: string | null;
  instrucoes?: string | null;
}
export interface PrescricaoPdfData {
  meta: PdfMeta;
  paciente: PacientePdf;
  medico?: MedicoAssinante | null;
  prescricao: {
    dataPrescricao: Date | string;
    status: string;
    validadeHoras?: number | null;
    observacoes?: string | null;
    itens: PrescricaoItemPdf[];
  };
}

export function renderPrescricao(
  doc: PDFKit.PDFDocument,
  data: PrescricaoPdfData,
): void {
  cabecalho(doc, 'Prescrição Médica', data.meta);
  pacienteBlock(doc, data.paciente);

  secao(doc, 'Dados da prescrição');
  kv(doc, 'Emitida em', fmtDataHora(data.prescricao.dataPrescricao));
  kv(doc, 'Situação', data.prescricao.status);
  if (data.prescricao.validadeHoras != null) {
    kv(doc, 'Validade', `${data.prescricao.validadeHoras} horas`);
  }

  secao(doc, 'Medicamentos');
  if (data.prescricao.itens.length === 0) {
    paragrafo(doc, 'Nenhum item prescrito.');
  } else {
    data.prescricao.itens.forEach((it, i) => {
      if (i > 0) doc.moveDown(0.4);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(`${i + 1}. ${it.nome}`);
      const posologia = [
        it.dose ? `Dose: ${it.dose}` : null,
        it.via ? `Via: ${it.via}` : null,
        it.frequencia ? `Frequência: ${it.frequencia}` : null,
      ]
        .filter(Boolean)
        .join('   ');
      if (posologia) doc.font('Helvetica').fontSize(9.5).fillColor('#334155').text(`   ${posologia}`);
      if (it.instrucoes) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#475569').text(`   ${it.instrucoes}`);
    });
  }

  if (data.prescricao.observacoes) {
    secao(doc, 'Observações');
    paragrafo(doc, data.prescricao.observacoes);
  }

  assinatura(doc, data.medico);
  rodape(doc, data.meta);
}
