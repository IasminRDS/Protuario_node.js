import {
  assinatura,
  cabecalho,
  fmtData,
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

export interface AltaEvolucaoPdf {
  createdAt: Date | string;
  tipo: string;
  avaliacao?: string | null;
  plano?: string | null;
}
export interface AltaPdfData {
  meta: PdfMeta;
  paciente: PacientePdf;
  medico?: MedicoAssinante | null;
  internacao: {
    leito: string;
    tipo: string;
    entrada: Date | string;
    alta?: Date | string | null;
    motivo?: string | null;
    cidPrincipal?: string | null;
    tipoAlta?: string | null;
    sumarioAlta?: string | null;
    cidAlta?: string | null;
  };
  evolucoes: AltaEvolucaoPdf[];
}

export function renderAlta(doc: PDFKit.PDFDocument, data: AltaPdfData): void {
  cabecalho(doc, 'Resumo de Alta Hospitalar', data.meta);
  pacienteBlock(doc, data.paciente);

  secao(doc, 'Dados da internação');
  kv(doc, 'Leito', data.internacao.leito);
  kv(doc, 'Tipo', data.internacao.tipo);
  kv(doc, 'Entrada', fmtDataHora(data.internacao.entrada));
  kv(doc, 'Alta', fmtDataHora(data.internacao.alta));
  if (data.internacao.cidPrincipal) kv(doc, 'CID principal', data.internacao.cidPrincipal);
  if (data.internacao.tipoAlta) kv(doc, 'Tipo de alta', data.internacao.tipoAlta);

  secao(doc, 'Motivo da internação');
  paragrafo(doc, data.internacao.motivo);

  secao(doc, 'Resumo clínico e conduta');
  paragrafo(doc, data.internacao.sumarioAlta);
  if (data.internacao.cidAlta) kv(doc, 'CID de alta', data.internacao.cidAlta);

  if (data.evolucoes.length > 0) {
    secao(doc, 'Evoluções durante a internação');
    data.evolucoes.forEach((e) => {
      kv(doc, fmtData(e.createdAt), e.tipo);
      if (e.avaliacao) paragrafo(doc, e.avaliacao);
      if (e.plano) paragrafo(doc, e.plano);
    });
  }

  secao(doc, 'Orientações ao paciente');
  paragrafo(
    doc,
    data.internacao.sumarioAlta
      ? 'Seguir as orientações do resumo clínico acima. Retornar ao serviço em caso de piora.'
      : 'Retornar ao serviço de saúde em caso de piora dos sintomas.',
  );

  assinatura(doc, data.medico);
  rodape(doc, data.meta);
}
