import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditExportService } from '../audit/audit.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';

export type ExportFormat = 'csv' | 'json';

const BATCH = 1000;
const MAX_ROWS = Number(process.env.EXPORT_MAX_ROWS ?? 100_000);

interface PacienteRow {
  id: bigint;
  nome: string;
  cpf: string | null;
  dataNascimento: Date;
  sexo: string;
  createdAt: Date;
}

/**
 * Export TENANT-SAFE de pacientes (LGPD). NUNCA usa pg_dump; sempre filtra por
 * hospital_id do usuário autenticado (isolamento entre hospitais). Streaming com
 * keyset pagination (id ASC, lotes de 1000, select mínimo → sem N+1), backpressure
 * e corte de volume. Toda execução é auditada.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditExport: AuditExportService,
  ) {}

  async streamPacientesExport(
    user: AuthenticatedUser,
    format: ExportFormat,
    res: Response,
  ): Promise<void> {
    const hospitalId = currentHospitalId();
    // ISOLAMENTO: sem hospital no contexto (ex.: SuperAdmin cross-tenant), o
    // export por hospital não faz sentido e seria vazamento — bloqueia.
    if (!hospitalId) {
      throw new ForbiddenException(
        'Exportação de pacientes requer contexto de hospital (tenant).',
      );
    }

    const filename = `pacientes-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader(
      'Content-Type',
      format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let aborted = false;
    res.on('close', () => {
      aborted = true;
    });

    let total = 0;
    let lastId: bigint | null = null;
    let first = true;

    try {
      await this.write(res, format === 'csv'
        ? '﻿' + 'nome;cpf;data_nascimento;sexo;criado_em\n' // BOM p/ Excel
        : '[');

      for (;;) {
        if (aborted) throw new Error('conexão encerrada pelo cliente');
        const rows = (await this.prisma.paciente.findMany({
          where: {
            hospitalId, // filtro EXPLÍCITO (o tenant-guard também aplica — defense in depth)
            deletedAt: null,
            ...(lastId !== null ? { id: { gt: lastId } } : {}),
          },
          orderBy: { id: 'asc' }, // ordenação estável p/ keyset
          take: BATCH,
          select: {
            id: true,
            nome: true,
            cpf: true,
            dataNascimento: true,
            sexo: true,
            createdAt: true,
          },
        })) as PacienteRow[];

        if (rows.length === 0) break;

        for (const r of rows) {
          if (total >= MAX_ROWS) break;
          if (format === 'csv') {
            await this.write(res, this.csvRow(r));
          } else {
            await this.write(res, (first ? '' : ',') + JSON.stringify(this.jsonRow(r)));
            first = false;
          }
          total += 1;
        }

        lastId = rows[rows.length - 1].id;
        if (total >= MAX_ROWS || rows.length < BATCH) break;
      }

      if (format === 'json') await this.write(res, ']');
      if (!res.writableEnded) res.end();

      await this.auditar(user, hospitalId, format, total, 'SUCESSO');
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      await this.auditar(user, hospitalId, format, total, 'FALHA', erro);
      if (!res.writableEnded) res.destroy(); // interrompe o stream em falha
    }
  }

  /** Escreve respeitando backpressure (aguarda 'drain' quando o buffer enche). */
  private write(res: Response, chunk: string): Promise<void> {
    return new Promise((resolve) => {
      if (res.write(chunk)) resolve();
      else res.once('drain', () => resolve());
    });
  }

  private dateOnly(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Proteção contra CSV injection: prefixa ' quando a célula inicia com =,+,-,@. */
  private csvCell(value: string | null): string {
    let s = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  private csvRow(r: PacienteRow): string {
    return (
      [
        this.csvCell(r.nome),
        this.csvCell(r.cpf),
        this.csvCell(this.dateOnly(r.dataNascimento)),
        this.csvCell(r.sexo),
        this.csvCell(r.createdAt.toISOString()),
      ].join(';') + '\n'
    );
  }

  private jsonRow(r: PacienteRow) {
    return {
      nome: r.nome,
      cpf: r.cpf,
      data_nascimento: this.dateOnly(r.dataNascimento),
      sexo: r.sexo,
      criado_em: r.createdAt.toISOString(),
    };
  }

  private async auditar(
    user: AuthenticatedUser,
    hospitalId: string,
    format: ExportFormat,
    total: number,
    status: 'SUCESSO' | 'FALHA',
    erro?: string,
  ): Promise<void> {
    await this.auditExport.logExport({
      tipo: 'PACIENTES_EXPORT',
      acao: 'EXPORTAR',
      status,
      userId: user.id,
      hospitalId,
      metadata: { format, total_registros: total, ...(erro ? { erro } : {}) },
    });
  }
}
