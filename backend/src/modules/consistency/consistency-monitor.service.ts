import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

export type Severity = 'info' | 'warn' | 'critical';
export type Invariant =
  | 'I-G2A' // paciente ↔ CRIAR_SUCCESS (bijeção implementada aqui)
  | 'I-G2-WINDOW'
  | 'I-G4'
  | 'I-G6'
  | 'ORPHANS';
// Nota: I-G2B (mutações gerais ↔ audit) é garantido estruturalmente por F0.1–F0.5
// (auditoria de sucesso in-tx). Não há fonte independente p/ monitorá-lo por query;
// I-G2A é a projeção verificável (create↔audit) com correspondência 1:1 real.

export interface CheckResult {
  invariant: Invariant;
  ok: boolean;
  severity: Severity;
  details: Record<string, unknown>;
  ts: string;
}

export interface ConsistencyReport {
  ok: boolean;
  results: CheckResult[];
  ts: string;
}

/**
 * F0.6-B — Monitor CONTÍNUO de invariantes derivados do banco (Camada B).
 * Sem conflict-graph, sem captura de história R/W: valida os invariantes que são
 * verificáveis por query direta (I-G2 bijeção, I-G4 contiguidade do COD, I-G6
 * WORM ativo, órfãos). Custo controlado (queries indexadas). Endpoint on-demand
 * + job periódico opcional (env).
 */
@Injectable()
export class ConsistencyMonitorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConsistencyMonitorService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const interval = this.config.get<number>('CONSISTENCY_MONITOR_INTERVAL_MS', 0);
    if (interval > 0) {
      this.timer = setInterval(() => {
        void this.runAll().then((r) => {
          if (!r.ok) {
            this.logger.error(
              `Violação de consistência: ${JSON.stringify(
                r.results.filter((x) => !x.ok),
              )}`,
            );
          }
        });
      }, interval);
      this.timer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private now(): string {
    return new Date().toISOString();
  }

  /** I-G2 (global): count(paciente) == count(CRIAR success). Bijeção create↔audit. */
  async checkBijection(): Promise<CheckResult> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ m: bigint; a: bigint }>>(
      `SELECT
         (SELECT count(*) FROM paciente) AS m,
         (SELECT count(*) FROM auditoria WHERE operacao='CRIAR' AND resultado='SUCESSO') AS a`,
    );
    const m = Number(rows[0].m);
    const a = Number(rows[0].a);
    const ok = m === a;
    return {
      invariant: 'I-G2A',
      ok,
      severity: ok ? 'info' : 'critical',
      details: { pacientes: m, auditCriar: a, diff: m - a },
      ts: this.now(),
    };
  }

  /** I-G2 na janela recente (heurística de I-G8: strong ⇒ tolerância 0). */
  async checkBijectionWindow(): Promise<CheckResult> {
    const win = this.config.get<number>('CONSISTENCY_WINDOW_MINUTES', 5);
    const rows = await this.prisma.$queryRawUnsafe<Array<{ m: bigint; a: bigint }>>(
      `SELECT
         (SELECT count(*) FROM paciente WHERE created_at >= now() - ($1 || ' minutes')::interval) AS m,
         (SELECT count(*) FROM auditoria WHERE operacao='CRIAR' AND resultado='SUCESSO'
             AND data_evento >= now() - ($1 || ' minutes')::interval) AS a`,
      String(win),
    );
    const m = Number(rows[0].m);
    const a = Number(rows[0].a);
    const ok = m === a;
    return {
      invariant: 'I-G2-WINDOW',
      ok,
      severity: ok ? 'info' : 'critical',
      details: { windowMinutes: win, pacientes: m, auditCriar: a, diff: m - a },
      ts: this.now(),
    };
  }

  /** I-G4: para cada agregado, aggregate_seq dos AUDIT_SUCCESS é {1..k} (sem gap/dup). */
  async checkCOD(): Promise<CheckResult> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ entity: string; entity_id: string; mismatch: bigint }>
    >(
      `WITH seqs AS (
         SELECT entity, entity_id, aggregate_seq,
                ROW_NUMBER() OVER (PARTITION BY entity, entity_id ORDER BY aggregate_seq) AS rn
         FROM auditoria
         WHERE resultado='SUCESSO' AND aggregate_seq IS NOT NULL AND entity IS NOT NULL
       )
       SELECT entity, entity_id,
              COUNT(*) FILTER (WHERE aggregate_seq <> rn) AS mismatch
       FROM seqs
       GROUP BY entity, entity_id
       HAVING COUNT(*) FILTER (WHERE aggregate_seq <> rn) > 0
       LIMIT 50`,
    );
    // Verificação INDEPENDENTE de duplicata (mesma (entity,entity_id,seq) 2x).
    const dups = await this.prisma.$queryRawUnsafe<
      Array<{ entity: string; entity_id: string; aggregate_seq: bigint; c: bigint }>
    >(
      `SELECT entity, entity_id, aggregate_seq, COUNT(*) AS c
         FROM auditoria
        WHERE resultado='SUCESSO' AND aggregate_seq IS NOT NULL AND entity IS NOT NULL
        GROUP BY entity, entity_id, aggregate_seq
       HAVING COUNT(*) > 1
        LIMIT 50`,
    );
    const ok = rows.length === 0 && dups.length === 0;
    return {
      invariant: 'I-G4',
      ok,
      severity: ok ? 'info' : 'critical',
      details: {
        gapsOrMisorder: rows.length,
        duplicates: dups.length,
        sample: [
          ...rows.map((r) => ({ entity: r.entity, entityId: r.entity_id, kind: 'gap' })),
          ...dups.map((d) => ({ entity: d.entity, entityId: d.entity_id, kind: 'dup', seq: Number(d.aggregate_seq) })),
        ],
      },
      ts: this.now(),
    };
  }

  /**
   * I-G6: WORM íntegro. Duas evidências combinadas:
   *  (a) triggers `auditoria_no_update/delete` existem e ENABLED (proteção ativa);
   *  (b) estatística FÍSICA — `pg_stat_all_tables.n_tup_upd/n_tup_del = 0` para
   *      `auditoria` (nenhuma mutação física ocorreu, mesmo que o trigger tenha
   *      sido reabilitado após uma adulteração — reforço contra adulteração retroativa).
   */
  async checkWorm(): Promise<CheckResult> {
    const trig = await this.prisma.$queryRawUnsafe<
      Array<{ tgname: string; tgenabled: string }>
    >(
      `SELECT tgname, tgenabled FROM pg_trigger
        WHERE tgrelid = 'auditoria'::regclass
          AND tgname IN ('auditoria_no_update','auditoria_no_delete')`,
    );
    const phys = await this.prisma.$queryRawUnsafe<Array<{ upd: bigint; del: bigint }>>(
      `SELECT coalesce(n_tup_upd,0) AS upd, coalesce(n_tup_del,0) AS del
         FROM pg_stat_all_tables WHERE relname='auditoria'`,
    );
    const present = trig.length === 2;
    const allEnabled = trig.every((r) => r.tgenabled === 'O');
    const upd = phys.length ? Number(phys[0].upd) : 0;
    const del = phys.length ? Number(phys[0].del) : 0;
    const ok = present && allEnabled && upd === 0 && del === 0;
    return {
      invariant: 'I-G6',
      ok,
      severity: ok ? 'info' : 'critical',
      details: {
        present,
        triggers: trig.map((r) => ({ name: r.tgname, enabled: r.tgenabled === 'O' })),
        physical: { n_tup_upd: upd, n_tup_del: del },
      },
      ts: this.now(),
    };
  }

  /** Órfãos: AUDIT_SUCCESS de domínio (paciente) sem paciente correspondente. */
  async checkOrphans(): Promise<CheckResult> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ id: bigint; entity_id: string }>
    >(
      `SELECT a.id, a.entity_id
         FROM auditoria a
         LEFT JOIN paciente p ON a.entity_id = p.id::text
        WHERE a.resultado='SUCESSO' AND a.entity='paciente' AND p.id IS NULL
        LIMIT 50`,
    );
    const ok = rows.length === 0;
    return {
      invariant: 'ORPHANS',
      ok,
      severity: ok ? 'info' : 'warn',
      details: {
        count: rows.length,
        sample: rows.map((r) => ({ auditId: r.id.toString(), entityId: r.entity_id })),
      },
      ts: this.now(),
    };
  }

  async runAll(): Promise<ConsistencyReport> {
    const results = await Promise.all([
      this.checkBijection(),
      this.checkBijectionWindow(),
      this.checkCOD(),
      this.checkWorm(),
      this.checkOrphans(),
    ]);
    return { ok: results.every((r) => r.ok), results, ts: this.now() };
  }

  /**
   * F0.6-C — exporter Prometheus (text format 0.0.4) a partir do runAll().
   * Thin layer: sem dependência externa. `consistency_ok{invariant}` (1/0),
   * `consistency_violations_total{invariant}` e o timestamp da última checagem.
   */
  async toPrometheus(): Promise<string> {
    const report = await this.runAll();
    const lines: string[] = [
      '# HELP consistency_ok 1 se o invariante está íntegro, 0 se violado.',
      '# TYPE consistency_ok gauge',
    ];
    for (const r of report.results) {
      lines.push(`consistency_ok{invariant="${r.invariant}"} ${r.ok ? 1 : 0}`);
    }
    lines.push('# HELP consistency_violations_total Nº de violações amostradas por invariante.');
    lines.push('# TYPE consistency_violations_total gauge');
    for (const r of report.results) {
      const v = typeof r.details.violations === 'number'
        ? (r.details.violations as number)
        : typeof r.details.count === 'number'
          ? (r.details.count as number)
          : r.ok ? 0 : 1;
      lines.push(`consistency_violations_total{invariant="${r.invariant}"} ${v}`);
    }
    lines.push('# HELP consistency_last_check_timestamp Unix ts da última checagem.');
    lines.push('# TYPE consistency_last_check_timestamp gauge');
    lines.push(`consistency_last_check_timestamp ${Math.floor(Date.now() / 1000)}`);
    return lines.join('\n') + '\n';
  }
}
