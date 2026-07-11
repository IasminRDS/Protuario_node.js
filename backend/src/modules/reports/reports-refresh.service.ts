import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

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
 *
 * CONEXÃO DEDICADA DE MANUTENÇÃO (RLS): REFRESH exige ser DONO da view — e a
 * posse não pode ir para prontuario_app (o refresh executaria a query da view
 * sob RLS e a esvaziaria). Por isso este service NÃO usa o PrismaService do
 * app: abre um client próprio na MAINTENANCE_DATABASE_URL (role dona), como as
 * migrations. Isso também isola qualquer erro daqui do pool de requests.
 */
@Injectable()
export class ReportsRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportsRefreshService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private client?: PrismaClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // Não agenda em testes nem quando explicitamente desabilitado.
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.REPORTS_REFRESH_DISABLED === 'true') return;

    const url =
      this.config.get<string>('MAINTENANCE_DATABASE_URL') ??
      this.config.getOrThrow<string>('DATABASE_URL');
    this.client = new PrismaClient({ datasources: { db: { url } } });

    this.timer = setInterval(() => void this.refreshAll(), REFRESH_INTERVAL_MS);
    this.timer.unref?.(); // não segura o event loop / process
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.client?.$disconnect();
  }

  /** Refresca as 4 views (CONCURRENTLY), sem sobreposição de execuções. */
  async refreshAll(): Promise<void> {
    if (this.running || !this.client) return;
    this.running = true;
    try {
      for (const view of REPORT_VIEWS) {
        try {
          await this.client.$executeRawUnsafe(
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
