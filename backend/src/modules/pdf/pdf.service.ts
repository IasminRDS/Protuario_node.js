import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { MedicoAssinante, PacientePdf, PdfMeta } from './templates/layout';
import { ProntuarioPdfData, renderProntuario } from './templates/prontuario.template';
import { PrescricaoPdfData, renderPrescricao } from './templates/prescricao.template';
import { AltaPdfData, renderAlta } from './templates/alta.template';

export interface PreparedPdf {
  filename: string;
  render: (doc: PDFKit.PDFDocument) => void;
}

@Injectable()
export class PdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

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
    entity: string,
    entityId: string,
    docId: string,
  ): Promise<void> {
    // Rastreabilidade LGPD da exportação (userId, hospitalId, ação, recurso,
    // timestamp e finalidade). O hospitalId é anexado automaticamente.
    await this.auditoria.registrar({
      usuarioId: actor.id,
      modulo: 'PDF',
      operacao: 'EXPORTAR_PDF',
      entity,
      entityId,
      objeto: docId,
      resultado: 'SUCESSO',
      reason: `Emissão de documento clínico (${entity}) em PDF`,
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

    await this.auditar(actor, 'prontuario', paciente.id.toString(), ctx.meta.docId);
    return {
      filename: `prontuario-${paciente.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      render: (doc) => renderProntuario(doc, data),
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

    await this.auditar(actor, 'prescricao', presc.id.toString(), ctx.meta.docId);
    return {
      filename: `prescricao-${presc.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      render: (doc) => renderPrescricao(doc, data),
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

    await this.auditar(actor, 'alta', internacao.id.toString(), ctx.meta.docId);
    return {
      filename: `alta-${internacao.id}-${ctx.meta.docId.slice(0, 8)}.pdf`,
      render: (doc) => renderAlta(doc, data),
    };
  }
}
