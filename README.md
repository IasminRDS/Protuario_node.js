# Prontuário Eletrônico E2 (PE-E2) / SNPE

Plataforma de prontuário eletrônico hospitalar estilo SUS. Monorepo com **API NestJS** e **frontend Next.js**, com fluxo clínico (triagem → atendimento → prescrição → alta), RBAC granular por permissão, multi-tenancy (multi-hospital), auditoria LGPD, Outbox/eventos e interoperabilidade **FHIR R4**.

## Estrutura

```
.
├── backend/     → API REST (NestJS + Prisma + PostgreSQL)
├── frontend/    → App web (Next.js 16 + TypeScript + Tailwind v4)
├── docs/        → Documentação de arquitetura (SNPE)
├── instance/    → Dados SQLite legados (preservados, NÃO versionados)
└── package.json → raiz (workspaces npm)
```

- **backend/** — NestJS 10, Prisma, PostgreSQL, JWT (access + refresh), RBAC por permissão, FSM clínica do paciente, Outbox + consumidores idempotentes, MPI (identidade nacional), locks de concorrência, FHIR. Swagger em `/api/docs`.
- **frontend/** — Next.js 16 (App Router), Axios com interceptors/refresh, Zustand, React Hook Form + Zod, design system próprio, RBAC de UI.

## Setup rápido

### Monorepo (raiz)
```bash
npm install            # instala backend + frontend (workspaces)
# suba o Postgres e prepare o banco (ver backend abaixo), depois:
npm run dev            # API (3000) + web (3001) juntos
npm run build | npm test
```

### Backend (porta 3000)
```bash
cd backend
cp .env.example .env          # ajuste segredos e DATABASE_URL
docker compose up -d postgres # ou um PostgreSQL local
npm install
npm run prisma:generate
npm run prisma:migrate        # aplica migrations
npm run prisma:seed           # perfis + admin (admin / Admin@123)
npm run start:dev             # http://localhost:3000/api/docs
```

### Frontend (porta 3001)
```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
npm install
npm run dev                        # http://localhost:3001
```

> Requisitos: **Node.js 20+** e **PostgreSQL 16** (ou Docker). Login inicial: `admin` / `Admin@123`.

## Diferenciais de arquitetura
- **Multi-tenancy real:** isolamento por `hospitalId` **automático** via middleware Prisma (`shared/tenant/tenant-guard.ts`) + `AsyncLocalStorage`. Nenhum serviço filtra manualmente; queries em modelo clínico sem tenant são **bloqueadas** (403). A identidade do cidadão permanece **nacional** (MPI/Cidadão).
- **FSM clínica no domínio puro** (`domain/patient/`): transições validadas no backend, independentes de framework; o frontend nunca altera estado direto.
- **Interoperabilidade FHIR R4** (`infra/fhir/`): `Patient`, `Encounter`, `MedicationRequest`, `Observation` como recursos crus.
- **Outbox + eventos idempotentes/ordenados**, auditoria LGPD imutável, RBAC granular por permissão, JWT com refresh.

## Tecnologias
NestJS · Prisma · PostgreSQL · JWT · class-validator · Jest/Supertest · Next.js 16 · Tailwind v4 · Zustand · React Hook Form + Zod · FHIR R4 · Docker.

## Nota sobre o legado
A aplicação **legada em Flask (Python)** e o **scaffold Next.js da raiz** foram **removidos** — substituídos por `backend/` (NestJS) e `frontend/` (Next.js). O histórico permanece recuperável via git. Dados legados em `instance/*.db` foram preservados (não versionados).

## Segredos
Nenhum segredo é versionado. Cada app tem seu `.env` (ignorado); os templates são `backend/.env.example` e `frontend/.env.local.example`.


(Teste.1)