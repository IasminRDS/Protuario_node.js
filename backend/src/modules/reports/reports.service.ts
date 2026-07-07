import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import {
  AtendimentoPorDiaDto,
  ExameRealizadoDto,
  OcupacaoLeitosDto,
  TempoMedioDto,
} from './dto/reports.dto';

/**
 * Leitura APENAS das materialized views (nenhuma agregação pesada em runtime,
 * nenhum refresh aqui). Todo resultado é isolado pelo hospital do token —
 * relatório de um tenant nunca enxerga dados de outro.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cláusula WHERE de tenant (SuperAdmin sem hospitalId → visão agregada). */
  private tenantWhere(): Prisma.Sql {
    const hospitalId = currentHospitalId();
    return hospitalId
      ? Prisma.sql`WHERE hospital_id = ${hospitalId}::uuid`
      : Prisma.empty;
  }

  private iso(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
  }

  async atendimentosPorDia(): Promise<AtendimentoPorDiaDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ dia: Date; total_atendimentos: bigint; atualizado_em: Date }>
    >(Prisma.sql`
      SELECT dia, total_atendimentos, atualizado_em
      FROM atendimentos_por_dia
      ${this.tenantWhere()}
      ORDER BY dia DESC
      LIMIT 90
    `);
    return rows.map((r) => ({
      dia: r.dia.toISOString().slice(0, 10),
      totalAtendimentos: Number(r.total_atendimentos),
      atualizadoEm: this.iso(r.atualizado_em),
    }));
  }

  async ocupacaoLeitos(): Promise<OcupacaoLeitosDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        ocupados: bigint;
        livres: bigint;
        total: bigint;
        taxa_ocupacao: Prisma.Decimal | string;
        atualizado_em: Date;
      }>
    >(Prisma.sql`
      SELECT ocupados, livres, total, taxa_ocupacao, atualizado_em
      FROM ocupacao_leitos
      ${this.tenantWhere()}
      LIMIT 1
    `);
    const r = rows[0];
    if (!r) {
      return { ocupados: 0, livres: 0, total: 0, taxaOcupacao: 0, atualizadoEm: null };
    }
    return {
      ocupados: Number(r.ocupados),
      livres: Number(r.livres),
      total: Number(r.total),
      taxaOcupacao: Number(r.taxa_ocupacao),
      atualizadoEm: this.iso(r.atualizado_em),
    };
  }

  async tempoMedio(): Promise<TempoMedioDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        total_atendimentos: bigint;
        media_minutos: Prisma.Decimal | string;
        atualizado_em: Date;
      }>
    >(Prisma.sql`
      SELECT total_atendimentos, media_minutos, atualizado_em
      FROM tempo_medio_atendimento
      ${this.tenantWhere()}
      LIMIT 1
    `);
    const r = rows[0];
    if (!r) {
      return { totalAtendimentos: 0, mediaMinutos: 0, atualizadoEm: null };
    }
    return {
      totalAtendimentos: Number(r.total_atendimentos),
      mediaMinutos: Number(r.media_minutos),
      atualizadoEm: this.iso(r.atualizado_em),
    };
  }

  async exames(): Promise<ExameRealizadoDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ codigo: string; tipo_exame: string; total: bigint; atualizado_em: Date }>
    >(Prisma.sql`
      SELECT codigo, tipo_exame, total, atualizado_em
      FROM exames_realizados
      ${this.tenantWhere()}
      ORDER BY total DESC
    `);
    return rows.map((r) => ({
      codigo: r.codigo,
      tipoExame: r.tipo_exame,
      total: Number(r.total),
      atualizadoEm: this.iso(r.atualizado_em),
    }));
  }
}
