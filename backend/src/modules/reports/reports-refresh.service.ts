import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

// Ordem/whitelist fixa (nomes nunca vêm de input → sem risco de injeção).
const REPORT_VIEWS = [
  'atendimentos_por_dia',
  'ocupacao_leitos',
  'tempo_medio_atendimento',
  'exames_realizados',
] as const;

const REFRESH_INTERVAL_MS = 5 * 60_000; // 5 min

/**
 * Refresh periódico das materialized views de relatório — caminho PORTÁTIL para
 * ambientes SEM pg_cron. Onde o pg_cron existe (ver migration), ambos rodam;
 * o REFRESH ... CONCURRENTLY é idempotente e não bloqueia leitura.
 *
 * Cada view é refrescada em um statement ISOLADO: REFRESH ... CONCURRENTLY não
 * pode rodar dentro de função/bloco transacional/multi-command.
 */
@Injectable()
export class ReportsRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsRefreshService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Não agenda em testes nem quando explicitamente desabilitado.
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.REPORTS_REFRESH_DISABLED === 'true') return;

    this.timer = setInterval(() => void this.refreshAll(), REFRESH_INTERVAL_MS);
    this.timer.unref?.(); // não segura o event loop / process
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Refresca as 4 views (CONCURRENTLY), sem sobreposição de execuções. */
  async refreshAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const view of REPORT_VIEWS) {
        try {
          await this.prisma.$executeRawUnsafe(
            `REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`,
          );
        } catch (e) {
          this.logger.warn(
            `Falha ao refrescar ${view}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }
}
