import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEvent } from '../events/base.event';
import { TOPIC_MPI } from '../events/event-types';
import { EVENT_BUS, EventBus } from '../../shared/events/event-bus';
import { logJson } from '../../shared/observability/structured-logger';
import { OutboxService } from './outbox.service';

/**
 * Worker de publicação do Outbox (polling), SEGURO PARA MÚLTIPLAS INSTÂNCIAS.
 *
 * Concorrência: `claimBatch` usa FOR UPDATE SKIP LOCKED — cada evento é pego por
 * um único worker. Crash-safety: eventos ficam em PROCESSING; se o worker cai
 * antes de concluir, `reapStale` os devolve a PENDING (nenhum evento perdido).
 * Entrega at-least-once; consumidores devem deduplicar por eventId
 * (IdempotencyService). Após publicar, marca SENT.
 */
@Injectable()
export class OutboxPublisherWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  private ticksSincePurge = 0;

  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly maxAttempts: number;
  private readonly staleClaimSeconds: number;
  private readonly retentionHours: number;
  private readonly purgeEveryTicks = 100;

  constructor(
    private readonly outbox: OutboxService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    config: ConfigService,
  ) {
    this.intervalMs = config.get<number>('OUTBOX_POLL_INTERVAL_MS', 2000);
    this.batchSize = config.get<number>('OUTBOX_BATCH_SIZE', 50);
    this.maxAttempts = config.get<number>('OUTBOX_MAX_ATTEMPTS', 10);
    this.staleClaimSeconds = Math.ceil(
      config.get<number>('OUTBOX_STALE_CLAIM_MS', 60000) / 1000,
    );
    this.retentionHours = config.get<number>('OUTBOX_RETENTION_HOURS', 168);
  }

  onModuleInit(): void {
    this.schedule();
    logJson('info', 'OutboxWorker', 'worker.started', {
      intervalMs: this.intervalMs,
      batchSize: this.batchSize,
    });
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private schedule(): void {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.tick().finally(() => this.schedule());
    }, this.intervalMs);
  }

  /** Um ciclo de despacho. Público para acionamento em testes. */
  async tick(): Promise<void> {
    if (this.running) {
      return; // evita sobreposição de ciclos na MESMA instância
    }
    this.running = true;
    try {
      // 1) Recupera PROCESSING órfãos de workers que caíram (crash-safety).
      const reaped = await this.outbox.reapStale(this.staleClaimSeconds);
      if (reaped > 0) {
        logJson('warn', 'OutboxWorker', 'stale.reaped', { count: reaped });
      }

      // 2) Reivindica um lote atomicamente (multi-instância seguro).
      const claimed = await this.outbox.claimBatch(this.batchSize);
      for (const row of claimed) {
        const event = row.payload as unknown as DomainEvent;
        const topic = this.resolveTopic(row.type);
        try {
          await this.eventBus.publish(topic, event);
          await this.outbox.markSent(row.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logJson('error', 'OutboxWorker', 'publish.failed', {
            traceId: event?.traceId,
            eventId: row.id,
            type: row.type,
            attempts: row.attempts,
            error: message,
          });
          await this.outbox.markRetryOrFailed(
            row.id,
            row.attempts,
            this.maxAttempts,
            message,
          );
        }
      }

      // 3) Purga periódica de SENT antigos (evita table bloat).
      if (++this.ticksSincePurge >= this.purgeEveryTicks) {
        this.ticksSincePurge = 0;
        const removed = await this.outbox.purgeSent(this.retentionHours);
        if (removed > 0) {
          logJson('info', 'OutboxWorker', 'outbox.purged', { removed });
        }
      }
    } catch (err) {
      logJson('error', 'OutboxWorker', 'tick.failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.running = false;
    }
  }

  private resolveTopic(type: string): string {
    if (type.startsWith('Cidadao')) {
      return TOPIC_MPI;
    }
    return 'snpe.events';
  }
}
