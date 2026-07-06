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

export interface ProntuarioEvolucaoPdf {
  createdAt: Date | string;
  diagnostico?: string | null;
  evolucao?: string | null;
  subjetivo?: string | null;
  objetivo?: string | null;
  avaliacao?: string | null;
  plano?: string | null;
  cidPrincipal?: string | null;
}
export interface ProntuarioExamePdf {
  tipo: string;
  status: string;
  interpretacao?: string | null;
  dataSolicitacao: Date | string;
  resultadoTexto?: string | null;
}
export interface ProntuarioPrescricaoPdf {
  dataPrescricao: Date | string;
  status: string;
  itens: Array<{ nome: string; dose?: string | null; via?: string | null; frequencia?: string | null }>;
}
export interface ProntuarioPdfData {
  meta: PdfMeta;
  paciente: PacientePdf;
  medico?: MedicoAssinante | null;
  evolucoes: ProntuarioEvolucaoPdf[];
  exames: ProntuarioExamePdf[];
  prescricoes: ProntuarioPrescricaoPdf[];
}

export function renderProntuario(
  doc: PDFKit.PDFDocument,
  data: ProntuarioPdfData,
): void {
  cabecalho(doc, 'Prontuário Clínico', data.meta);
  pacienteBlock(doc, data.paciente);

  secao(doc, 'Histórico clínico / Evoluções');
  if (data.evolucoes.length === 0) {
    paragrafo(doc, 'Nenhum registro de evolução.');
  } else {
    data.evolucoes.forEach((e, i) => {
      if (i > 0) doc.moveDown(0.5);
      kv(doc, 'Data', fmtDataHora(e.createdAt));
      if (e.cidPrincipal) kv(doc, 'CID-10', e.cidPrincipal);
      if (e.diagnostico) kv(doc, 'Diagnóstico', e.diagnostico);
      if (e.subjetivo) kv(doc, 'S (subjetivo)', e.subjetivo);
      if (e.objetivo) kv(doc, 'O (objetivo)', e.objetivo);
      if (e.avaliacao) kv(doc, 'A (avaliação)', e.avaliacao);
      if (e.plano) kv(doc, 'P (plano)', e.plano);
      if (e.evolucao) paragrafo(doc, e.evolucao);
    });
  }

  secao(doc, 'Exames');
  if (data.exames.length === 0) {
    paragrafo(doc, 'Nenhum exame solicitado.');
  } else {
    data.exames.forEach((ex) => {
      const interp = ex.interpretacao ? ` — ${ex.interpretacao}` : '';
      kv(doc, ex.tipo, `${ex.status}${interp} (${fmtDataHora(ex.dataSolicitacao)})`);
      if (ex.resultadoTexto) paragrafo(doc, ex.resultadoTexto);
    });
  }

  secao(doc, 'Prescrições');
  if (data.prescricoes.length === 0) {
    paragrafo(doc, 'Nenhuma prescrição registrada.');
  } else {
    data.prescricoes.forEach((p) => {
      kv(doc, 'Prescrição', `${fmtDataHora(p.dataPrescricao)} · ${p.status}`);
      p.itens.forEach((it) => {
        const partes = [it.dose, it.via, it.frequencia].filter(Boolean).join(' · ');
        doc.font('Helvetica').fontSize(10).fillColor('#0f172a').text(`  • ${it.nome}${partes ? ` (${partes})` : ''}`);
      });
    });
  }

  assinatura(doc, data.medico);
  rodape(doc, data.meta);
}
