# Testes E2E — Isolamento multi-tenant

Testes de ponta a ponta com **PostgreSQL real** (Testcontainers) — sem mock de Prisma, sem SQLite. Validam que o middleware de tenant isola dados por `hospitalId` em produção.

## Pré-requisitos
- **Docker** em execução (Testcontainers sobe um `postgres:16-alpine`).
- Node 20+.

## Rodar
```bash
cd backend
npm ci
npx prisma generate          # gera o client (necessário para compilar)
npm run test:e2e             # jest --config ./test/jest-e2e.json
```

O setup (`test/helpers/test-app.ts`):
1. sobe o container Postgres e obtém um `DATABASE_URL` dinâmico;
2. aplica as **migrations Prisma reais** (`prisma migrate deploy`);
3. inicializa o `AppModule` completo (prefixo `/api`, versionamento, ValidationPipe, guards/middlewares globais).

## Isolamento entre testes
`TRUNCATE ... RESTART IDENTITY CASCADE` em `beforeEach` (determinístico; nada persiste).
Transaction-rollback **não** se aplica a E2E sobre HTTP (o app usa a própria conexão).

## Contexto de tenant
O `hospitalId` vem do **usuário autenticado** (JWT → `JwtStrategy` → `AsyncLocalStorage`).
Não há header de tenant cru (seria forjável). Os helpers criam usuário+token por hospital:
`createTestUser(hospitalId)`, `signToken(user)`, `authorize(req, token)`, `createPaciente(hospitalId)`.

## Cenários cobertos
1. Isolamento básico (A ≠ B) · 2. Bypass por ID (404) · 3. Update isolado · 4. Delete isolado ·
5. Create com escopo correto · 6. count/aggregate escopados · 7. sem `hospitalId` → 403 ·
8. hospital sem dados → lista vazia · 9. **Concorrência** (A e B em paralelo, sem vazamento de ALS) ·
10. **FHIR** `GET /fhir/Patient/:id` isolado.
