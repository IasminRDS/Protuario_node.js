import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';

/**
 * Painel epidemiológico e de gestão — agregados de leitura para o dashboard
 * regional: notificações compulsórias, ocupação de leitos, fila de regulação
 * e distribuição de classificação de risco (Manchester).
 */
@Injectable()
export class EpidemiologiaService {
  constructor(private readonly prisma: PrismaService) {}

  private tenantFilter() {
    const hospitalId = currentHospitalId();
    return hospitalId ? { hospitalId } : {};
  }

  private since(dias: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d;
  }

  /** Cartões de resumo do painel. */
  async resumo() {
    const tenant = this.tenantFilter();
    const h24 = this.since(1);

    const [
      notifPendentes,
      notifImediatas,
      leitosTotal,
      leitosOcupados,
      filaRegulacao,
      triagens24h,
      internacoesAtivas,
    ] = await Promise.all([
      this.prisma.notificacaoCompulsoria.count({
        where: { ...tenant, status: 'PENDENTE' },
      }),
      this.prisma.notificacaoCompulsoria.count({
        where: { ...tenant, status: 'PENDENTE', imediata: true },
      }),
      this.prisma.leito.count({ where: { ...tenant, ativo: true } }),
      this.prisma.leito.count({
        where: { ...tenant, ativo: true, status: 'ocupado' },
      }),
      this.prisma.encaminhamento.count({
        where: {
          ...tenant,
          status: { in: ['solicitado', 'em_analise', 'autorizado', 'agendado', 'devolvido'] },
        },
      }),
      this.prisma.triagem.count({
        where: { ...tenant, createdAt: { gte: h24 } },
      }),
      this.prisma.internacao.count({ where: { ...tenant, status: 'ATIVA' } }),
    ]);

    return {
      notificacoes: { pendentes: notifPendentes, imediatas: notifImediatas },
      leitos: {
        total: leitosTotal,
        ocupados: leitosOcupados,
        taxaOcupacao: leitosTotal > 0 ? Math.round((leitosOcupados / leitosTotal) * 1000) / 10 : 0,
      },
      regulacao: { filaAberta: filaRegulacao },
      triagens24h,
      internacoesAtivas,
    };
  }

  /** Notificações por agravo no período (para gráfico de barras). */
  async notificacoesPorAgravo(dias = 30) {
    const rows = await this.prisma.notificacaoCompulsoria.groupBy({
      by: ['agravo'],
      where: { ...this.tenantFilter(), createdAt: { gte: this.since(dias) } },
      _count: { _all: true },
      orderBy: { _count: { agravo: 'desc' } },
      take: 15,
    });
    return rows.map((r) => ({ agravo: r.agravo, total: r._count._all }));
  }

  /** Notificações por município/UF de residência do paciente. */
  async notificacoesPorMunicipio(dias = 30) {
    const rows = await this.prisma.notificacaoCompulsoria.findMany({
      where: { ...this.tenantFilter(), createdAt: { gte: this.since(dias) } },
      select: { pacienteId: true },
    });
    // Paciente à parte (não via include RLS-dependente — ver vigilancia.list).
    const ids = [...new Set(rows.map((r) => r.pacienteId))];
    const pacientes = ids.length
      ? await this.prisma.paciente.findMany({
          where: { id: { in: ids } },
          select: { id: true, municipio: true, uf: true },
        })
      : [];
    const porId = new Map(pacientes.map((p) => [p.id.toString(), p]));

    const mapa = new Map<string, { municipio: string; uf: string; total: number }>();
    for (const r of rows) {
      const p = porId.get(r.pacienteId.toString());
      const municipio = p?.municipio?.trim() || 'Não informado';
      const uf = p?.uf?.trim().toUpperCase() || '—';
      const chave = `${municipio}|${uf}`;
      const atual = mapa.get(chave) ?? { municipio, uf, total: 0 };
      atual.total += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total).slice(0, 20);
  }

  /** Ocupação de leitos por setor (para barras empilhadas). */
  async ocupacaoLeitos() {
    const tenant = this.tenantFilter();
    const setores = await this.prisma.setor.findMany({
      where: { ...tenant, ativo: true },
      select: {
        nome: true,
        sigla: true,
        tipo: true,
        leitos: { where: { ativo: true }, select: { status: true } },
      },
    });

    return setores
      .map((s) => {
        const contar = (status: string) =>
          s.leitos.filter((l) => l.status === status).length;
        const total = s.leitos.length;
        const ocupados = contar('ocupado');
        return {
          setor: s.sigla || s.nome,
          nome: s.nome,
          tipo: s.tipo,
          total,
          ocupados,
          livres: contar('livre'),
          reservados: contar('reservado'),
          higienizacao: contar('em_higienizacao'),
          interditados: contar('interditado'),
          taxaOcupacao: total > 0 ? Math.round((ocupados / total) * 1000) / 10 : 0,
        };
      })
      .filter((s) => s.total > 0);
  }

  /** Fila de regulação por status e por prioridade. */
  async filaRegulacao() {
    const tenant = this.tenantFilter();
    const [porStatus, porPrioridade] = await Promise.all([
      this.prisma.encaminhamento.groupBy({
        by: ['status'],
        where: tenant,
        _count: { _all: true },
      }),
      this.prisma.encaminhamento.groupBy({
        by: ['prioridade'],
        where: {
          ...tenant,
          status: { in: ['solicitado', 'em_analise', 'autorizado', 'agendado', 'devolvido'] },
        },
        _count: { _all: true },
      }),
    ]);
    return {
      porStatus: porStatus.map((r) => ({ status: r.status, total: r._count._all })),
      porPrioridade: porPrioridade.map((r) => ({
        prioridade: r.prioridade,
        total: r._count._all,
      })),
    };
  }

  /** Distribuição da classificação de risco (Manchester) no período. */
  async triagemManchester(dias = 7) {
    const rows = await this.prisma.triagem.groupBy({
      by: ['classificacao'],
      where: { ...this.tenantFilter(), createdAt: { gte: this.since(dias) } },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      classificacao: r.classificacao ?? 'NAO_CLASSIFICADO',
      total: r._count._all,
    }));
  }
}
