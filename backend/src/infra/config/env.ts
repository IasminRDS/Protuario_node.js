import { z } from 'zod';

/**
 * Validação das variáveis de ambiente (cap. 184: segredos fora do código).
 * A aplicação NÃO inicia com configuração inválida — falha cedo e explícito.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'homologation', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),

  CORS_ORIGINS: z.string().default('*'),

  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // Backbone de eventos (SNPE). Sem Kafka disponível, usa-se o adapter de log.
  KAFKA_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('snpe-mpi'),

  // Outbox worker
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().default(2000),
  OUTBOX_BATCH_SIZE: z.coerce.number().default(50),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().default(10),
  // Tempo para considerar um claim (PROCESSING) órfão e reenfileirá-lo.
  OUTBOX_STALE_CLAIM_MS: z.coerce.number().default(60000),
  // Retenção de eventos SENT antes da purga (evita table bloat).
  OUTBOX_RETENTION_HOURS: z.coerce.number().default(168),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}
