# Prontuário Eletrônico E2 (PE-E2) — Backend

API REST implementada a partir do **Documento de Arquitetura de Software (v2.0)**, seguindo a
arquitetura-alvo definida no documento: **NestJS + Prisma + PostgreSQL**, com autenticação
**JWT + Refresh Token**, autorização **RBAC**, auditoria imutável e conformidade com a **LGPD**.

> Este backend convive com o sistema legado (Flask) sem alterá-lo. É a base da migração
> incremental descrita no Cap. 27 do documento.

## Arquitetura implementada (Clean Architecture + módulos por domínio)

```
Cliente ─HTTPS─▶ Controller ─▶ Service ─▶ Repository ─▶ Prisma ─▶ PostgreSQL
                    (fino)     (regras)   (acesso a dados)
```

| Camada | Papel | Onde |
|---|---|---|
| Controller | Recebe requisição, valida DTO, aplica RBAC. **Sem regra de negócio.** | `modules/*/**.controller.ts` |
| Service | **Única** fonte das regras de negócio (RN-001..062). | `modules/*/**.service.ts` |
| Repository | Acesso a dados (encapsula Prisma). | `modules/*/**.repository.ts` |
| Domain | Invariantes puras, independentes de framework. | `core/domain/entities` |
| Shared | Guards, interceptors, filtros, pipes, decorators. | `shared/` |
| Infra | Prisma, config validada (Zod), Argon2. | `infra/` |

### Recursos transversais (globais)
- **Autenticação:** `JwtAuthGuard` (global) + `@Public()` para exceções (login/refresh).
- **Autorização (RBAC):** `RolesGuard` + `@Roles(PerfilNome...)` (cap. 116).
- **Resposta padronizada:** `ResponseInterceptor` → `{ success, data, message }` (cap. 142).
- **Erros padronizados:** `AllExceptionsFilter` → `{ success:false, timestamp, path, error:{code,message} }`; nunca expõe stack/SQL (cap. 156).
- **Validação de entrada:** `ValidationPipe` (whitelist, anti mass-assignment) + `class-validator`.
- **Rate limiting:** `ThrottlerGuard` (cap. 157). **Headers:** Helmet. **CORS** restrito.
- **Auditoria imutável:** `AuditoriaService.registrar()` (append-only) chamado nas operações críticas (RN-045/046).

## Módulos entregues nesta fase (fatia vertical)
- **auth** — login (com bloqueio por tentativas), refresh, logout, change-password (UC-01/19/20).
- **perfis** — leitura e criação de perfis RBAC.
- **usuarios** — CRUD com login único (RN-001), senha Argon2, soft delete (RN-005), auditoria (UC-02).
- **pacientes** — CRUD do núcleo do domínio: identificação obrigatória (RN-006), anti-duplicidade (RN-007), soft delete preservando histórico (RN-009) (UC-03/04/12).
- **auditoria** — consulta de eventos (Admin/Gestor, UC-18).

O **schema Prisma** já contempla as **14 tabelas** do dicionário de dados (cap. 25), incluindo os
domínios ainda não expostos por API (agenda, triagem, atendimento, prontuário, prescrição, exame,
internação, vacinação, produto, movimentação de estoque). Os próximos módulos seguem o mesmo molde.

## SNPE — MPI + Outbox (primeiro núcleo nacional)

Primeiro bounded context do Sistema Nacional (evolução Strangler Fig, sem microservices):

- **MPI (`modules/mpi`)** — identidade nacional do cidadão. Camadas `domain` (entidade `Cidadao`,
  VOs `CPF`/`CNS`, portas) / `application` (`CreateCidadaoUseCase`, `ResolveCidadaoUseCase`) /
  `infrastructure` (repositório Prisma, Unit of Work) / `controllers` / `dto`. Gera `cidadaoId`
  (UUID v7) e deduplica por **CPF → CNS → heurística**.
- **Outbox (`modules/outbox`)** — `TransactionalOutbox` grava o evento na **mesma transação** do
  agregado (Unit of Work); `OutboxPublisherWorker` (polling) drena `PENDING`, publica e marca `SENT`.
  Semântica **at-least-once** → consumidores devem ser **idempotentes** (dedupe por `eventId`).
  Se o worker cair após publicar e antes de marcar `SENT`, o evento é republicado — **zero perda**.
- **Eventos (`modules/events`)** — envelope imutável e versionado (`CidadaoCreated`, `CidadaoResolved`),
  chave de partição = `cidadaoId`.
- **EventBus (`shared/events`)** — `KAFKA_ENABLED=true` usa `KafkaEventBus` (kafkajs sob demanda);
  caso contrário `LoggingEventBus` (mock substituível, logs estruturados). Troca por DI.

Endpoints: `POST /api/v1/mpi/cidadaos` (registrar/deduplicar), `GET /api/v1/mpi/cidadaos/resolve`.
Após `git pull`, rode `npm run prisma:migrate` para criar `cidadao` e `outbox_event`. Requer `npm i`
(nova dependência `uuid`).

## Endpoints principais
```
POST   /api/v1/auth/login | /refresh | /logout | /change-password
GET    /api/v1/perfis                 POST /api/v1/perfis
GET    /api/v1/usuarios[?page&pageSize&nome&ativo]
GET    /api/v1/usuarios/:id           POST/PATCH/DELETE /api/v1/usuarios[/:id]
GET    /api/v1/pacientes[?page&pageSize&sort&order&nome&cpf]
GET    /api/v1/pacientes/:id          POST/PUT/PATCH/DELETE /api/v1/pacientes[/:id]
GET    /api/v1/auditoria[?page&modulo&usuarioId]
```
Documentação interativa (Swagger/OpenAPI): **`/api/docs`**.

## Pré-requisitos
> ⚠️ O ambiente atual **não possui Node.js instalado**. Instale antes de rodar:
- **Node.js 20 LTS** e **npm**
- **PostgreSQL 16** (local) **ou Docker + Docker Compose**

## Como rodar (desenvolvimento)

### Opção A — Docker (recomendado)
```bash
cd backend
cp .env.example .env          # ajuste os segredos JWT
docker compose up -d postgres redis
npm ci
npm run prisma:generate
npm run prisma:migrate        # cria as tabelas
npm run prisma:seed           # perfis + admin inicial
npm run start:dev
```

### Opção B — tudo em containers
```bash
cd backend
docker compose up --build     # sobe postgres + redis + api (migrate deploy automático)
```

Acesse `http://localhost:3000/api/docs`. Login inicial: `admin` / `Admin@123` (troque em produção).

## Testes
```bash
npm test           # unitários (regras de domínio + services)
npm run test:cov   # com cobertura
```
Cobertura prioriza (cap. 212): regras clínicas, autenticação, autorização, pacientes, persistência.

## Segurança / LGPD (resumo)
- Senhas em **Argon2**, nunca em texto puro; `senha`/`refreshTokenHash` nunca retornam em respostas.
- **RBAC** por perfil; endpoints protegidos por padrão.
- **Auditoria imutável** de operações críticas; **soft delete** para preservar histórico clínico.
- HTTPS obrigatório em produção; Helmet, CORS restrito, rate limiting; erros sem vazamento interno.

## Decisões e pendências (ver análise crítica entregue)
- **A1 (identificação do paciente):** exigimos CPF **ou** CNS; CPF/CNS únicos quando presentes.
- **A2 (Prontuário):** modelado como entradas imutáveis por atendimento, agregadas por paciente.
- Próximos passos sugeridos: módulos assistenciais (agenda→triagem→atendimento→prontuário),
  processamento assíncrono (BullMQ/Redis) e criptografia de campos ultrassensíveis.
