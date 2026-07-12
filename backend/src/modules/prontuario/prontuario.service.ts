import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TerminologiaService } from '../terminologia/terminologia.service';

export interface TimelineItem {
  id: string;
  tipo:
    | 'ATENDIMENTO'
    | 'TRIAGEM'
    | 'PRESCRICAO'
    | 'EVOLUCAO'
    | 'INTERNACAO'
    | 'ALTA'
    | 'EXAME'
    | 'VACINA'
    | 'CIRURGIA'
    | 'ENCAMINHAMENTO'
    | 'NOTIFICACAO';
  data: Date;
  resumo: string;
  /** Detalhe secundário (unidade, CID decodificado, resultado...). */
  detalhe?: string;
}

@Injectable()
export class ProntuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly terminologia: TerminologiaService,
  ) {}

  /** "CID — descrição" quando o código consta no catálogo. */
  private cid(codigo: string | null | undefined): string | null {
    if (!codigo) return null;
    const desc = this.terminologia.descricaoCid10(codigo);
    return desc ? `${codigo} — ${desc}` : codigo;
  }

  /**
   * Guard de tenant: confirma que o paciente é visível ao hospital do chamador
   * (Paciente está sob RLS + escopo app-layer). Obrigatório antes de ler modelos
   * clínicos que ficam FORA de TENANT_MODELS/RLS (Internacao, ExameSolicitado,
   * VacinaAplicada, Cirurgia) e da tabela global de Auditoria — sem isto, um
   * pacienteId de outro hospital vazaria PHI cross-tenant. Retorna 404 (não 403)
   * para não confirmar a existência de pacientes de outro tenant.
   */
  private async assertPacienteVisivel(pid: bigint): Promise<void> {
    const p = await this.prisma.paciente.findFirst({
      where: { id: pid, deletedAt: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Paciente não encontrado.');
  }

  /**
   * Sumário do Paciente (IPS-like): cabeçalho com alertas clínicos (alergias,
   * tipo sanguíneo), problemas ativos com CID decodificado, medicamentos em
   * uso, vacinas e a linha do tempo longitudinal completa.
   */
  async sumario(pacienteId: string) {
    const pid = BigInt(pacienteId);

    const paciente = await this.prisma.paciente.findFirst({
      where: { id: pid, deletedAt: null },
      select: {
        id: true,
        nome: true,
        nomeSocial: true,
        cpf: true,
        cns: true,
        sexo: true,
        dataNascimento: true,
        tipoSanguineo: true,
        alergias: true,
        municipio: true,
        uf: true,
        telefone: true,
        status: true,
      },
    });
    if (!paciente) throw new NotFoundException('Paciente não encontrado.');

    const d90 = new Date();
    d90.setDate(d90.getDate() - 90);

    const [internacoesAtivas, encaminhamentosAbertos, prescricoes90d, vacinas, notifPendentes] =
      await Promise.all([
        this.prisma.internacao.findMany({
          where: { pacienteId: pid, status: 'ATIVA' },
          select: { id: true, cidPrincipal: true, hipoteseDiag: true, tipo: true, entrada: true, leito: true },
        }),
        this.prisma.encaminhamento.findMany({
          where: {
            pacienteId: pid,
            status: { in: ['solicitado', 'em_analise', 'autorizado', 'agendado', 'devolvido'] },
          },
          select: { id: true, especialidade: true, cid: true, prioridade: true, status: true },
        }),
        this.prisma.prescricao.findMany({
          where: { atendimento: { pacienteId: pid }, createdAt: { gte: d90 } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { medicamento: true, dosagem: true, frequencia: true, duracao: true, createdAt: true },
        }),
        this.prisma.vacinaAplicada.findMany({
          where: { pacienteId: pid },
          orderBy: { dataAplicacao: 'desc' },
          take: 15,
          select: {
            nomeVacina: true,
            dose: true,
            dataAplicacao: true,
            unidade: true,
            vacina: { select: { nome: true } },
          },
        }),
        this.prisma.notificacaoCompulsoria.count({
          where: { pacienteId: pid, status: 'PENDENTE' },
        }),
      ]);

    const problemasAtivos = [
      ...internacoesAtivas.map((i) => ({
        origem: 'INTERNACAO' as const,
        descricao: this.cid(i.cidPrincipal) ?? i.hipoteseDiag ?? `Internação ${i.tipo}`,
        desde: i.entrada as Date | null,
        contexto: `Internado — leito ${i.leito}`,
      })),
      ...encaminhamentosAbertos.map((e) => ({
        origem: 'REGULACAO' as const,
        descricao: this.cid(e.cid) ?? e.especialidade,
        desde: null as Date | null,
        contexto: `Aguardando ${e.especialidade} (${e.prioridade}, ${e.status})`,
      })),
    ];

    return {
      paciente: {
        ...paciente,
        id: paciente.id.toString(),
        alergias: paciente.alergias?.trim() || null,
      },
      alertas: {
        alergias: paciente.alergias?.trim() || null,
        tipoSanguineo: paciente.tipoSanguineo,
        notificacoesPendentes: notifPendentes,
        internado: internacoesAtivas.length > 0,
      },
      problemasAtivos,
      medicamentosEmUso: prescricoes90d.map((p) => ({
        medicamento: p.medicamento,
        posologia: [p.dosagem, p.frequencia, p.duracao].filter(Boolean).join(' · ') || null,
        prescritoEm: p.createdAt,
      })),
      vacinas: vacinas.map((v) => ({
        nome: v.vacina?.nome ?? v.nomeVacina ?? 'Vacina',
        dose: v.dose,
        data: v.dataAplicacao,
        unidade: v.unidade,
      })),
      timeline: (await this.timeline(pacienteId)).timeline,
    };
  }

  /**
   * "Quem acessou meu prontuário" (transparência LGPD, art. 9º/18). Lê a trilha
   * de auditoria de acessos a este paciente — a Auditoria fica FORA do RLS, então
   * é lida diretamente. Não expõe conteúdo clínico, só o registro do acesso.
   */
  async acessos(pacienteId: string, limit = 100) {
    await this.assertPacienteVisivel(BigInt(pacienteId));
    const rows = await this.prisma.auditoria.findMany({
      where: {
        entity: 'paciente',
        entityId: pacienteId,
        operacao: { in: ['PATIENT_VIEWED', 'PDF_PRONTUARIO', 'EXPORTAR'] },
      },
      orderBy: { dataEvento: 'desc' },
      take: limit,
      include: {
        usuario: { select: { nome: true, perfil: { select: { nome: true } } } },
      },
    });

    return rows.map((r) => ({
      id: r.id.toString(),
      quem: r.usuario?.nome ?? 'Sistema',
      perfil: r.usuario?.perfil?.nome ?? null,
      operacao: r.operacao,
      finalidade: r.reason ?? 'assistencial',
      ip: r.ip,
      quando: r.dataEvento,
    }));
  }

  /** Monta a linha do tempo clínica consolidada do paciente. */
  async timeline(pacienteId: string) {
    const pid = BigInt(pacienteId);
    await this.assertPacienteVisivel(pid);

    const [
      triagens,
      atendimentos,
      evolucoes,
      prescricoes,
      internacoes,
      exames,
      vacinas,
      cirurgias,
      encaminhamentos,
      notificacoes,
    ] = await Promise.all([
      this.prisma.triagem.findMany({ where: { pacienteId: pid } }),
      this.prisma.atendimento.findMany({ where: { pacienteId: pid, deletedAt: null } }),
      this.prisma.prontuario.findMany({ where: { pacienteId: pid } }),
      this.prisma.prescricao.findMany({ where: { atendimento: { pacienteId: pid } } }),
      this.prisma.internacao.findMany({ where: { pacienteId: pid } }),
      this.prisma.exameSolicitado.findMany({
        where: { pacienteId: pid },
        include: { tipoExame: { select: { nome: true } } },
      }),
      this.prisma.vacinaAplicada.findMany({
        where: { pacienteId: pid },
        include: { vacina: { select: { nome: true } } },
      }),
      this.prisma.cirurgia.findMany({ where: { pacienteId: pid } }),
      this.prisma.encaminhamento.findMany({ where: { pacienteId: pid } }),
      this.prisma.notificacaoCompulsoria.findMany({ where: { pacienteId: pid } }),
    ]);

    const items: TimelineItem[] = [
      ...triagens.map((t): TimelineItem => ({
        id: `tri-${t.id}`,
        tipo: 'TRIAGEM',
        data: t.createdAt,
        resumo: `Triagem — ${t.classificacao ?? 'sem classificação'}`,
        detalhe: t.queixaPrincipal ?? undefined,
      })),
      ...atendimentos.map((a): TimelineItem => ({
        id: `enc-${a.id}`,
        tipo: 'ATENDIMENTO',
        data: a.data,
        resumo: `Atendimento (${a.tipo}) — ${a.status}`,
      })),
      ...evolucoes.map((e): TimelineItem => ({
        id: `evo-${e.id}`,
        tipo: 'EVOLUCAO',
        data: e.createdAt,
        resumo: e.diagnostico ? `Evolução — ${e.diagnostico}` : 'Evolução clínica',
      })),
      ...prescricoes.map((p): TimelineItem => ({
        id: `pre-${p.id}`,
        tipo: 'PRESCRICAO',
        data: p.createdAt,
        resumo: `Prescrição — ${p.medicamento}`,
        detalhe: [p.dosagem, p.frequencia].filter(Boolean).join(' · ') || undefined,
      })),
      ...internacoes.flatMap((i): TimelineItem[] => {
        const eventos: TimelineItem[] = [
          {
            id: `int-${i.id}`,
            tipo: 'INTERNACAO',
            data: i.entrada,
            resumo: `Internação (${i.tipo}) — leito ${i.leito}`,
            detalhe: this.cid(i.cidPrincipal) ?? i.hipoteseDiag ?? undefined,
          },
        ];
        if (i.alta) {
          eventos.push({
            id: `alta-${i.id}`,
            tipo: 'ALTA',
            data: i.alta,
            resumo: `Alta hospitalar — ${i.tipoAlta ?? i.status}`,
            detalhe: this.cid(i.cidAlta) ?? undefined,
          });
        }
        return eventos;
      }),
      ...exames.map((e): TimelineItem => ({
        id: `exa-${e.id}`,
        tipo: 'EXAME',
        data: e.dataResultado ?? e.dataSolicitacao,
        resumo: `Exame — ${e.tipoExame.nome} (${e.status})`,
        detalhe: e.interpretacao
          ? `Resultado: ${e.interpretacao}${e.resultadoValor ? ` — ${e.resultadoValor} ${e.resultadoUnidade ?? ''}` : ''}`
          : undefined,
      })),
      ...vacinas.map((v): TimelineItem => ({
        id: `vac-${v.id}`,
        tipo: 'VACINA',
        data: v.dataAplicacao,
        resumo: `Vacina — ${v.vacina?.nome ?? v.nomeVacina ?? 'não identificada'}${v.dose ? ` (${v.dose})` : ''}`,
        detalhe: v.unidade ?? undefined,
      })),
      ...cirurgias.map((c): TimelineItem => ({
        id: `cir-${c.id}`,
        tipo: 'CIRURGIA',
        data: c.dataInicio ?? c.dataAgendada ?? c.createdAt,
        resumo: `Cirurgia — ${c.descricao} (${c.status})`,
      })),
      ...encaminhamentos.map((e): TimelineItem => ({
        id: `reg-${e.id}`,
        tipo: 'ENCAMINHAMENTO',
        data: e.dataSolicitacao,
        resumo: `Encaminhamento — ${e.especialidade} (${e.status})`,
        detalhe: this.cid(e.cid) ?? undefined,
      })),
      ...notificacoes.map((n): TimelineItem => ({
        id: `not-${n.id}`,
        tipo: 'NOTIFICACAO',
        data: n.createdAt,
        resumo: `Notificação compulsória — ${n.agravo} (${n.status})`,
        detalhe: this.cid(n.cid) ?? undefined,
      })),
    ].sort((a, b) => b.data.getTime() - a.data.getTime());

    return { pacienteId, timeline: items };
  }
}
