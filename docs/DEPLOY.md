# SNPE — Deploy & Operação (Runbook)

Guia de implantação e operação do backend. Complementa [OPERACOES.md](OPERACOES.md)
(higiene de build) e [HOMOLOGACAO.md](HOMOLOGACAO.md) (credenciamento das
integrações oficiais).

---

## 1. Pré-requisitos

- **Node.js 20+** e npm (monorepo com workspaces `backend`/`frontend`).
- **PostgreSQL 16** (RLS exige a versão do client ≥ a do servidor no `pg_dump`).
- **Docker** (para a imagem de produção e para o Postgres do E2E via Testcontainers).

## 2. Variáveis de ambiente

O boot **valida o ambiente** (Zod, `backend/src/infra/config/env.ts`) e **falha
cedo** se algo estiver inválido. Principais:

### Núcleo
| Var | Default | Nota |
|---|---|---|
| `NODE_ENV` | `development` | `production` endurece validações |
| `PORT` | `3000` | |
| `DATABASE_URL` | — | conexão do app (em prod: role `prontuario_app`) |
| `MAINTENANCE_DATABASE_URL` | (=DATABASE_URL) | role **dona**: refresh de views + `pg_dump` |
| `CORS_ORIGINS` | — | lista separada por vírgula |

### Segredos / auth
| Var | Regra |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | **≥32 chars em produção** (senão o app não sobe) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` |
| `LOGIN_MAX_ATTEMPTS` | `5` |
| `MFA_ENFORCE_EXPORT` | exige MFA para export de PHI |

### Isolamento (RLS)
| Var | Nota |
|---|---|
| `RLS_ENABLED` | `true` só quando `DATABASE_URL` aponta para a role `prontuario_app` |

### Integrações gov.br (ver [HOMOLOGACAO.md](HOMOLOGACAO.md))
`GOVBR_ENABLED`, `GOVBR_SIMULATOR`, `GOVBR_CLIENT_ID`, `GOVBR_CLIENT_SECRET`,
`GOVBR_AUTHORIZE_URL`, `GOVBR_TOKEN_URL`, `GOVBR_USERINFO_URL`,
`GOVBR_REDIRECT_URI`, `GOVBR_FRONTEND_URL`.
> ⚠️ `GOVBR_SIMULATOR=true` é **proibido em produção** (bypass de autenticação —
> o boot recusa).

### Assinatura de documentos (ICP-Brasil)
| Var | Nota |
|---|---|
| `DOC_SIGNING_PRIVATE_KEY` | PEM. **Obrigatória em produção** (sem ela o boot recusa: par efêmero invalidaria assinaturas após restart) |
| `DOC_VERIFY_URL` | destino do QR de verificação pública |

### Eventos & consistência
`KAFKA_ENABLED`, `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `OUTBOX_POLL_INTERVAL_MS`,
`OUTBOX_BATCH_SIZE`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_STALE_CLAIM_MS`,
`OUTBOX_RETENTION_HOURS`, `CONSISTENCY_WINDOW_MINUTES`,
`CONSISTENCY_MONITOR_INTERVAL_MS`.

### Rate limiting / export
`THROTTLE_TTL` (**milissegundos** — throttler v6), `THROTTLE_LIMIT`,
`EXPORT_MAX_ROWS`, `EXPORT_TIMEOUT_MS`, `EXPORT_THROTTLE_LIMIT`,
`EXPORT_THROTTLE_TTL_MS`, `RETENTION_YEARS` (default 20 — CFM Res. 1.821/2007).

## 3. Build & execução

### Docker (produção) — imagem única a partir da RAIZ
```bash
docker build -t pee2-api:<sha> .        # NÃO ./backend — usa o lock da raiz
```
O `Dockerfile` da raiz builda o monorepo (o `npm ci` exige os `package.json` de
todos os workspaces + o `package-lock.json` da raiz). A imagem inclui o
`postgresql-client-16` (para o `pg_dump` do backup). Referencie sempre a imagem
por `:${SHA}` (imutável), nunca `:latest`.

### Compose de referência (homologação/demo)
`backend/docker-compose.yml` sobe Postgres, Kafka, Prometheus, Grafana e a API
(`NODE_ENV: homologation`, simulador gov.br, segredos de dev ≥32).

### Local (dev)
```bash
cd backend
npm run prisma:generate
npm run start:dev        # watch
```

## 4. Banco & migrations

- Migrations rodam na **role dona** (`prontuario`) — precisam de ownership:
  ```bash
  npm run -w backend prisma:deploy    # prisma migrate deploy
  ```
  No Docker, o `CMD` roda `prisma migrate deploy` antes de subir a API.
- **Nunca** aplique migrations com a role `prontuario_app` (não-dona).

## 5. Ativando RLS em produção

O isolamento no banco (defesa em profundidade) só passa a valer quando:
1. `RLS_ENABLED=true`, **e**
2. `DATABASE_URL` aponta para a role **`prontuario_app`** (`NOBYPASSRLS`,
   não-dona), criada pela migration `20260705000000_rls_phase1`.

Pré-condição: os testes E2E de RLS verdes (`rls-phase1`, `rls-tenant-models`).
Enquanto não estiverem, **não** troque para a role `prontuario_app` (o app leria
vazio). Migrations/seed/monitor continuam na role dona (que ignora RLS — sem
`FORCE`). Detalhes em [VISAO-GERAL.md §6](VISAO-GERAL.md#6-modelo-de-tenant-e-segurança-defesa-em-profundidade).

## 6. Backup

`POST /api/v1/backup` executa `pg_dump` usando a `MAINTENANCE_DATABASE_URL`
(role dona — precisa bypassar RLS e ter ownership). Requer `postgresql-client-16`
no ambiente (já incluso na imagem). Ver [FASE5-EXPORT-BACKUP.md](FASE5-EXPORT-BACKUP.md).

## 7. Observabilidade

- **Métricas**: `GET /metrics` (Prometheus, público, sem JWT). Histograma de
  latência por método/rota/status.
- **Consistência**: `GET /api/v1/internal/consistency/{health,report}`
  (`admin:full`) e `/metrics` (scrape sem JWT).
- **Logs**: JSON estruturado (`shared/observability/structured-logger.ts`).
- Compose de referência inclui Prometheus + Grafana.

## 8. Checklist de produção

- [ ] `NODE_ENV=production`
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` ≥ 32 chars (secret manager)
- [ ] `DATABASE_URL` → role `prontuario_app` + `RLS_ENABLED=true`
- [ ] `MAINTENANCE_DATABASE_URL` → role dona (backup/refresh)
- [ ] `GOVBR_SIMULATOR=false` + credenciais reais
- [ ] `DOC_SIGNING_PRIVATE_KEY` (certificado ICP-Brasil)
- [ ] `migrate deploy` aplicado (role dona)
- [ ] Testes E2E de RLS verdes antes de virar a role do app
- [ ] Backup agendado + retenção (`RETENTION_YEARS`)
- [ ] Integrações oficiais credenciadas conforme [HOMOLOGACAO.md](HOMOLOGACAO.md)

## 9. CI/CD

`.github/workflows/ci.yml`: `build-test` (npm ci → prisma → lint
`--max-warnings=0` → build → unit → **E2E com Postgres real**) + `docker`
(build da imagem da raiz). `main` é protegida (checks obrigatórios + aprovação
de revisor diferente do autor). Ver [OPERACOES.md](OPERACOES.md) para os gotchas
de build.
