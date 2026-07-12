import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditExportService, ExportTipo } from '../audit/audit.service';
import {
  DocumentosService,
  RegistroAssinatura,
} from '../documentos/documentos.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import {
  blocoAssinaturaDigital,
  MedicoAssinante,
  PacientePdf,
  PdfMeta,
} from './templates/layout';
import { ProntuarioPdfData, renderProntuario } from './templates/prontuario.template';
import { PrescricaoPdfData, renderPrescricao } from './templates/prescricao.template';
import { AltaPdfData, renderAlta } from './templates/alta.template';

export interface PreparedPdf {
  filename: string;
  docId: string;
  render: (doc: PDFKit.PDFDocument) => void;
  assinatura: RegistroAssinatura;
}

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditExport: AuditExportService,
    private readonly documentos: DocumentosService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Monta o PDF em buffer, anexa o bloco de assinatura digital + QR de
   * verificação, assina (SHA-256 → RSA) e persiste o registro. O QR aponta para
   * a página pública de verificação usando o `docId` (conhecido antes do hash).
   */
  async montarEAssinar(prepared: PreparedPdf): Promise<{ filename: string; buffer: Buffer }> {
    const verifyBase = this.config.get<string>(
      'DOC_VERIFY_URL',
      'http://localhost:3001/verificar',
    );
    const verifyUrl = `${verifyBase}/${prepared.docId}`;
    const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 120 });

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      prepared.render(doc);
      blocoAssinaturaDigital(doc, {
        signatarioNome: prepared.assinatura.signatarioNome,
        signatarioDoc: prepared.assinatura.signatarioDoc ?? null,
        docId: prepared.docId,
        verifyUrl,
        qrPng,
      });
      doc.end();
    });

    await this.documentos.registrar(prepared.docId, buffer, prepared.assinatura);
    return { filename: prepared.filename, buffer };
  }

  /** Filtro de tenant p/ modelos NÃO cobertos pelo tenant-guard (isolamento manual). */
  private tenantFilter() {
    const hospitalId = currentHospitalId();
    return hospitalId ? { hospitalId } : {};
  }

  private toPacientePdf(p: {
    nome: string;
    cpf: string | null;
    cns: string | null;
    dataNascimento: Date;
    sexo: string;
  }): PacientePdf {
    return {
      nome: p.nome,
      cpf: p.cpf,
      cns: p.cns,
      dataNascimento: p.dataNascimento,
      sexo: p.sexo,
    };
  }

  /** Resolve metadados do documento: hospital, assinante (usuário atual + CRM). */
  private async resolverContexto(
    actor: AuthenticatedUser,
  ): Promise<{ meta: PdfMeta; medico: MedicoAssinante }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: BigInt(actor.id) },
      select: { nome: true, login: true, medico: { select: { crm: true } } },
    });
    const hospitalId = currentHospitalId();
    const hospital = hospitalId
      ? await this.prisma.hospital.findUnique({
          where: { id: hospitalId },
          select: { nome: true },
        })
      : null;

    const meta: PdfMeta = {
      docId: randomUUID(),
      hospitalNome: hospital?.nome ?? 'Rede Nacional de Prontuário',
      hospitalId,
      geradoPorNome: usuario?.nome ?? actor.login,
      geradoPorLogin: actor.login,
      geradoEm: new Date(),
    };
    const medico: MedicoAssinante = {
      nome: usuario?.nome ?? actor.login,
      crm: usuario?.medico?.crm ?? '—',
    };
    return { meta, medico };
  }

  private async auditar(
    actor: AuthenticatedUser,
    tipo: ExportTipo,
    documento: string,
    entityId: string,
    docId: string,
  ): Promise<void> {
    // Trilha LGPD UNIFICADA (mesma taxonomia de export/backup/import): tipo/acao
    // padronizados + metadata estruturado. entity/entityId (indexados) preservam
    // a "trilha de acesso do paciente". hospitalId anexado automaticamente.
    await this.auditExport.logExport({
      tipo,
      acao: 'EXPORTAR',
      status: 'SUCESSO',
      userId: actor.id,
      entity: documento,
      entityId,
      objeto: docId,
      metadata: { documento, docId, entityId },
    });
  }

  // --- Prontuário ------------------------------------------------------------
  async prepararProntuario(
    pacienteId: string,
    actor: AuthenticatedUser,
  ): Promise<PreparedPdf> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: BigInt(pacienteId) }, // tenant-guard aplica hospitalId
    });
    if (!paciente) throw new NotFoundException('Paciente não encontrado.');

    const [evolucoes, exames, prescricoes, ctx] = await Promise.all([
      this.prisma.prontuario.findMany({
        where: { pacienteId: paciente.id }, // Prontuario é tenant-guarded
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.exameSolicitado.findMany({
        where: { pacienteId: paciente.id, ...this.tenantFilter() },
        orderBy: { dataSolicitacao: 'desc' },
        take: 20,
        include: { tipoExame: { select: { codigo: true, nome: true } } },
      }),
      this.prisma.prescricaoHospitalar.findMany({
        where: { pacienteId: paciente.id, ...this.tenantFilter() },
        orderBy: { dataPrescricao: 'desc' },
        take: 10,
        include: { itens: { include: { medicamento: { select: { nomeGenerico: true } } } } },
      }),
      this.resolverContexto(actor),
    ]);

    const data: ProntuarioPdfData = {
      meta: ctx.meta,
      medico: ctx.medico,
      paciente: this.toPacientePdf(paciente),
      evolucoes: evolucoes.map((e) => ({
        createdAt: e.createdAt,
        diagnostico: e.diagnostico,
        evolucao: e.evolucao,
        subjetivo: e.subjetivo,
        objetivo: e.objetivo,
        avaliacao: e.avaliacao,
        plano: e.plano,
        cidPrincipal: e.cidPrincipal,
      })),
      exames: exames.map((ex) => ({
        tipo: `${ex.tipoExame.codigo} — ${ex.tipoExame.nome}`,
        status: ex.status,
        interpretacao: ex.interpretacao,
        dataSolicitacao: ex.dataSolicitacao,
        resultadoTexto: ex.resultadoTexto,
      })),
      prescricoes: prescricoes.map((p) => ({
        dataPrescricao: p.dataPrescricao,
        status: p.status,
        itens: p.itens.map((i) => ({
          nome: i.nomeLivre ?? i.medicamento?.nomeGenerico ?? 'Medicamento',
          dose: i.dose,
          via: i.via,
          frequencia: i.frequencia,
        })),
      })),
    };

    await this.auditar(actor, 'PDF_PRONTUARIO', 'prontuario', paciente.id.toString(), ctx.meta.docId);
    return {
      filename: `prontuario-${paciente.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      docId: ctx.meta.docId,
      render: (doc) => renderProntuario(doc, data),
      assinatura: {
        tipo: 'PRONTUARIO',
        pacienteId: paciente.id,
        hospitalId: currentHospitalId(),
        signatarioId: actor.id,
        signatarioNome: ctx.medico.nome,
        signatarioDoc: ctx.medico.crm !== '—' ? `CRM ${ctx.medico.crm}` : null,
      },
    };
  }

  // --- Prescrição ------------------------------------------------------------
  async prepararPrescricao(
    prescricaoId: string,
    actor: AuthenticatedUser,
  ): Promise<PreparedPdf> {
    const presc = await this.prisma.prescricaoHospitalar.findFirst({
      where: { id: BigInt(prescricaoId), ...this.tenantFilter() },
      include: { itens: { include: { medicamento: { select: { nomeGenerico: true } } } } },
    });
    if (!presc) throw new NotFoundException('Prescrição não encontrada.');

    const paciente = await this.prisma.paciente.findUnique({
      where: { id: presc.pacienteId },
    });
    if (!paciente) throw new NotFoundException('Paciente da prescrição não encontrado.');

    const ctx = await this.resolverContexto(actor);
    const data: PrescricaoPdfData = {
      meta: ctx.meta,
      medico: ctx.medico,
      paciente: this.toPacientePdf(paciente),
      prescricao: {
        dataPrescricao: presc.dataPrescricao,
        status: presc.status,
        validadeHoras: presc.validadeHoras,
        observacoes: presc.observacoes,
        itens: presc.itens.map((i) => ({
          nome: i.nomeLivre ?? i.medicamento?.nomeGenerico ?? 'Medicamento',
          dose: i.dose,
          via: i.via,
          frequencia: i.frequencia,
          instrucoes: i.instrucoes,
        })),
      },
    };

    await this.auditar(actor, 'PDF_PRESCRICAO', 'prescricao', presc.id.toString(), ctx.meta.docId);
    return {
      filename: `prescricao-${presc.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      docId: ctx.meta.docId,
      render: (doc) => renderPrescricao(doc, data),
      assinatura: {
        tipo: 'PRESCRICAO',
        pacienteId: presc.pacienteId,
        hospitalId: currentHospitalId(),
        signatarioId: actor.id,
        signatarioNome: ctx.medico.nome,
        signatarioDoc: ctx.medico.crm !== '—' ? `CRM ${ctx.medico.crm}` : null,
      },
    };
  }

  // --- Alta ------------------------------------------------------------------
  async prepararAlta(
    internacaoId: string,
    actor: AuthenticatedUser,
  ): Promise<PreparedPdf> {
    const internacao = await this.prisma.internacao.findFirst({
      where: { id: BigInt(internacaoId), ...this.tenantFilter() },
      include: {
        leitoRef: { select: { numero: true } },
        evolucoes: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!internacao) throw new NotFoundException('Internação não encontrada.');

    const paciente = await this.prisma.paciente.findUnique({
      where: { id: internacao.pacienteId },
    });
    if (!paciente) throw new NotFoundException('Paciente da internação não encontrado.');

    const ctx = await this.resolverContexto(actor);
    const data: AltaPdfData = {
      meta: ctx.meta,
      medico: ctx.medico,
      paciente: this.toPacientePdf(paciente),
      internacao: {
        leito: internacao.leitoRef?.numero ?? internacao.leito,
        tipo: internacao.tipo,
        entrada: internacao.entrada,
        alta: internacao.alta,
        motivo: internacao.motivo,
        cidPrincipal: internacao.cidPrincipal,
        tipoAlta: internacao.tipoAlta,
        sumarioAlta: internacao.sumarioAlta,
        cidAlta: internacao.cidAlta,
      },
      evolucoes: internacao.evolucoes.map((e) => ({
        createdAt: e.createdAt,
        tipo: e.tipo,
        avaliacao: e.avaliacao,
        plano: e.plano,
      })),
    };

    await this.auditar(actor, 'PDF_ALTA', 'alta', internacao.id.toString(), ctx.meta.docId);
    return {
      filename: `alta-${internacao.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      docId: ctx.meta.docId,
      render: (doc) => renderAlta(doc, data),
      assinatura: {
        tipo: 'ALTA',
        pacienteId: internacao.pacienteId,
        hospitalId: currentHospitalId(),
        signatarioId: actor.id,
        signatarioNome: ctx.medico.nome,
        signatarioDoc: ctx.medico.crm !== '—' ? `CRM ${ctx.medico.crm}` : null,
      },
    };
  }
}
