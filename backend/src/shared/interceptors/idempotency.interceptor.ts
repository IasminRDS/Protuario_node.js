import { createHash } from 'crypto';
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { from, lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../infra/prisma/prisma.service';

const POLL_TRIES = 100; // ~2s total
const POLL_INTERVAL_MS = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface KeyRow {
  request_hash: string;
  status: string;
  response: unknown;
}

/**
 * Idempotência ATÔMICA (§1.4). Sem "check-then-act": a posse da chave é obtida
 * por INSERT ... ON CONFLICT DO NOTHING RETURNING (claim atômico no banco).
 *
 *  - vencedor (INSERT retornou linha): executa o handler; persiste a resposta;
 *    em falha, REMOVE a chave (libera p/ retry).
 *  - duplicada (INSERT não retornou): se completed → replay; se in_progress →
 *    aguarda (poll curto) e faz replay; hash de request divergente → 422.
 *
 * Sem `Idempotency-Key` no header, a rota passa direto (idempotência opt-in).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['idempotency-key'] as string | undefined;
    if (!key) return next.handle();

    const hash = createHash('sha256')
      .update(`${req.method}\n${req.originalUrl}\n${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    return from(this.run(key, hash, next));
  }

  private async run(
    key: string,
    hash: string,
    next: CallHandler,
  ): Promise<unknown> {
    // Claim ATÔMICO: só uma request insere; as demais não retornam nada.
    const claimed = await this.prisma.$queryRaw<{ key: string }[]>(Prisma.sql`
      INSERT INTO idempotency_keys (key, request_hash, status)
      VALUES (${key}, ${hash}, 'in_progress')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `);

    if (claimed.length === 1) {
      // Vencedor: executa a lógica exatamente uma vez.
      try {
        const payload = await lastValueFrom(next.handle());
        await this.prisma.$executeRaw(Prisma.sql`
          UPDATE idempotency_keys
             SET response = ${JSON.stringify(payload ?? null)}::jsonb,
                 status = 'completed', completed_at = now()
           WHERE key = ${key}
        `);
        return payload;
      } catch (err) {
        // Libera a chave: uma falha não pode "prender" a idempotência.
        await this.prisma.$executeRaw(Prisma.sql`
          DELETE FROM idempotency_keys WHERE key = ${key} AND status = 'in_progress'
        `);
        throw err;
      }
    }

    // Duplicada (concorrente ou tardia): replay determinístico.
    for (let i = 0; i < POLL_TRIES; i++) {
      const rows = await this.prisma.$queryRaw<KeyRow[]>(Prisma.sql`
        SELECT request_hash, status, response FROM idempotency_keys WHERE key = ${key}
      `);
      const row = rows[0];
      if (!row) break; // vencedor falhou e liberou a chave → cliente deve reenviar
      if (row.request_hash !== hash) {
        throw new UnprocessableEntityException(
          'Idempotency-Key reutilizada com payload diferente.',
        );
      }
      if (row.status === 'completed') {
        return row.response; // REPLAY do resultado original
      }
      await sleep(POLL_INTERVAL_MS);
    }

    throw new ConflictException(
      'Operação idempotente em andamento ou liberada; reenvie a requisição.',
    );
  }
}
