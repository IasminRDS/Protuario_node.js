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

  // Conexão de MANUTENÇÃO (role DONA): REFRESH de materialized views e pg_dump
  // exigem ownership/bypass de RLS — não podem rodar como prontuario_app.
  // Sem valor, cai em DATABASE_URL (ambientes sem RLS ativo).
  MAINTENANCE_DATABASE_URL: z.string().url().optional(),

  // Segredos fortes: >=32 chars em produção (256 bits). Em dev/test aceita 16.
  JWT_ACCESS_SECRET: z
    .string()
    .min(process.env.NODE_ENV === 'production' ? 32 : 16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(process.env.NODE_ENV === 'production' ? 32 : 16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),

  // Retenção legal do prontuário (CFM Res. 1.821/2007: mínimo 20 anos a contar
  // do último registro). Base para o relatório de elegibilidade ao expurgo.
  RETENTION_YEARS: z.coerce.number().default(20),

  // MFA step-up nas rotas de export/backup (LGPD). false só em teste/CI.
  MFA_ENFORCE_EXPORT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Login gov.br (OIDC). SIMULATOR=true usa o IdP embutido (dev/homolog); em
  // produção, aponte issuer/endpoints/credenciais para sso.acesso.gov.br.
  GOVBR_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  GOVBR_SIMULATOR: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true')
    // Segurança: o IdP simulador autentica qualquer usuário ativo SEM senha.
    // Ligado em produção = bypass total de autenticação. Falha no boot.
    .refine((sim) => !(sim && process.env.NODE_ENV === 'production'), {
      message:
        'GOVBR_SIMULATOR=true é proibido em produção (bypass de autenticação). ' +
        'Configure as credenciais reais do gov.br e defina GOVBR_SIMULATOR=false.',
    }),
  GOVBR_CLIENT_ID: z.string().default('snpe-dev'),
  GOVBR_CLIENT_SECRET: z.string().default(''),
  GOVBR_AUTHORIZE_URL: z.string().default(''), // vazio = usa o simulador embutido
  GOVBR_TOKEN_URL: z.string().default(''),
  GOVBR_USERINFO_URL: z.string().default(''),
  GOVBR_REDIRECT_URI: z
    .string()
    .default('http://localhost:3000/api/v1/auth/govbr/callback'),
  // Para onde o backend redireciona após concluir o login federado.
  GOVBR_FRONTEND_URL: z.string().default('http://localhost:3001/login'),

  // F0.6-B ConsistencyMonitor: janela recente (I-G8 heurístico) e intervalo do
  // job periódico (0 = desligado; endpoint on-demand sempre disponível).
  CONSISTENCY_WINDOW_MINUTES: z.coerce.number().default(5),
  CONSISTENCY_MONITOR_INTERVAL_MS: z.coerce.number().default(0),

  // RLS Fase 1: ativa o enforcement de tenant no banco (SET LOCAL app.hospital_id).
  // Só ative junto com DATABASE_URL apontando para a role NÃO-dona prontuario_app.
  RLS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

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
