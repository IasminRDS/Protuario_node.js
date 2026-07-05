-- ============================================================================
-- Idempotência atômica (§1.4). O claim da chave é feito por INSERT-first com
-- ON CONFLICT DO NOTHING (nunca "check-then-act"), de modo que APENAS UMA
-- request executa a lógica; concorrentes/tardias fazem replay do resultado.
--
-- `status`: 'in_progress' (claim feito, handler rodando) | 'completed' (resposta
-- persistida). Em falha do handler, a linha é REMOVIDA (libera a chave p/ retry).
-- ============================================================================

CREATE TABLE idempotency_keys (
  key          text PRIMARY KEY,
  request_hash text NOT NULL,
  status       text NOT NULL DEFAULT 'in_progress',
  response     jsonb,
  http_status  integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idempotency_keys_created_idx ON idempotency_keys (created_at);
