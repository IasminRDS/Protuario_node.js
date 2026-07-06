// Helpers de layout compartilhados pelos templates clínicos (pdfkit).
// Estrutura semântica (cabeçalho hospital → paciente → corpo → assinatura →
// rodapé de auditoria), renderizada em PDF sem dependência de browser.

export interface PdfMeta {
  docId: string;
  hospitalNome: string;
  hospitalId: string | null;
  geradoPorNome: string;
  geradoPorLogin: string;
  geradoEm: Date;
}

export interface MedicoAssinante {
  nome: string;
  crm: string;
}

export interface PacientePdf {
  nome: string;
  cpf?: string | null;
  cns?: string | null;
  dataNascimento?: Date | string | null;
  sexo?: string | null;
}

const PRIMARY = '#0f766e';
const MUTED = '#64748b';
const INK = '#0f172a';
const LINE = '#e2e8f0';

export function fmtData(d?: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}
export function fmtDataHora(d?: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

export function linha(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .strokeColor(LINE)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
}

export function cabecalho(
  doc: PDFKit.PDFDocument,
  titulo: string,
  meta: PdfMeta,
): void {
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(16).text(meta.hospitalNome);
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text('Prontuário Eletrônico Hospitalar — SNPE');
  doc.moveDown(0.5);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(titulo);
  doc.moveDown(0.3);
  linha(doc);
  doc.moveDown(0.6);
}

export function secao(doc: PDFKit.PDFDocument, titulo: string): void {
  doc.moveDown(0.6);
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(11).text(titulo.toUpperCase());
  doc.moveDown(0.2);
  doc.fillColor(INK).font('Helvetica').fontSize(10);
}

export function kv(doc: PDFKit.PDFDocument, chave: string, valor?: string | null): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#334155')
    .text(`${chave}: `, { continued: true })
    .font('Helvetica')
    .fillColor(INK)
    .text(valor && valor.trim() ? valor : '—');
}

export function paragrafo(doc: PDFKit.PDFDocument, texto?: string | null): void {
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(INK)
    .text(texto && texto.trim() ? texto : '—', { align: 'justify' });
}

export function pacienteBlock(doc: PDFKit.PDFDocument, p: PacientePdf): void {
  secao(doc, 'Identificação do paciente');
  kv(doc, 'Nome', p.nome);
  kv(doc, 'CPF', p.cpf ?? undefined);
  kv(doc, 'CNS', p.cns ?? undefined);
  kv(doc, 'Nascimento', fmtData(p.dataNascimento));
  kv(doc, 'Sexo', p.sexo ?? undefined);
}

export function assinatura(
  doc: PDFKit.PDFDocument,
  medico?: MedicoAssinante | null,
): void {
  doc.moveDown(2.5);
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.strokeColor('#94a3b8').lineWidth(1).moveTo(x, y).lineTo(x + 230, y).stroke();
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(medico?.nome ?? 'Responsável clínico');
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(MUTED)
    .text(medico?.crm && medico.crm !== '—' ? `CRM ${medico.crm}` : 'CRM não informado');
}

export function rodape(doc: PDFKit.PDFDocument, meta: PdfMeta): void {
  doc.moveDown(1.5);
  linha(doc);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED);
  doc.text(`Documento nº ${meta.docId}`);
  doc.text(
    `Gerado por ${meta.geradoPorNome} (${meta.geradoPorLogin}) em ${fmtDataHora(meta.geradoEm)}`,
  );
  doc.text(
    `Tenant: ${meta.hospitalId ?? 'nacional'} · Documento controlado — acesso registrado em auditoria (LGPD).`,
  );
}
