# Fase 5 — Exportação, Backup & Auditoria (fechamento de ciclo)

Documento de referência do fechamento da Fase 5: UI de exportação/backup,
cobertura de auditoria LGPD, checklist de validação E2E (browser), hardening de
produção e o desenho da evolução futura (exportação criptografada).

> Escopo desta entrega: **UX + rastreabilidade + compliance**. O backend de
> export/backup já validado (streaming, tenant-safe, RBAC, keyset pagination) **não
> foi reescrito** — apenas recebeu hardening aditivo e um endpoint de auditoria de
> relatório.

---

## 1. O que foi entregue

### Frontend (Next.js / App Router)
- **Página `/exportacao`** (`frontend/src/app/(app)/exportacao/page.tsx`)
  - Seção **Exportar pacientes**: botões `Exportar CSV` / `Exportar JSON`, loading
    por formato, download automático, feedback de sucesso/erro.
  - Seção **Backup** (somente SuperAdmin): botão `Gerar backup`, indicador de
    progresso, mensagens específicas para 403 / 503 / 429 / 500.
- **Módulo** `frontend/src/modules/export/`
  - `export.service.ts` — download por blob respeitando `Content-Disposition`,
    reusando o client axios existente (Bearer + refresh transparente).
  - `hooks/useExport.ts` — `useMutation` + mapeamento de erro por STATUS.
- **RBAC na UI** (defense-in-depth; o backend continua a autoridade):
  - Export → perfis `Administrador` / `Recepcao`.
  - Backup → perfil `SuperAdmin`.
  - Item de menu `/exportacao` gated por perfil (`nav.ts` + `Sidebar.tsx`).
- **Relatórios** (`ReportsPage.tsx`): botões `CSV atendimentos` / `CSV exames` que,
  além do download client-side, registram a exportação na trilha LGPD.

### Backend (NestJS)
- **Auditoria RELATORIO** — `POST /reports/export/audit`
  (`RELATORIO` / `EXPORTAR`), com catálogo fechado de relatórios (sem texto livre
  na trilha). Fecha o ciclo "quem exportou qual relatório, quando, quantas linhas".
- **Hardening**:
  - Rate limit por rota via `@Throttle` (export e backup, mais restritos que o
    global). `ttl` em **ms** (throttler v6).
  - Timeout configurável no export (`EXPORT_TIMEOUT_MS`) + log estruturado JSON
    (`logJson`) em início/fim/falha.
  - Variáveis de ambiente documentadas em `backend/.env.example`.

### Matriz de auditoria (padronizada em `AuditExportService`)

| tipo               | acao          | origem                         |
|--------------------|---------------|--------------------------------|
| `CSV_IMPORT`       | `IMPORTAR`    | upload CSV                     |
| `PACIENTES_EXPORT` | `EXPORTAR`    | `GET /export/pacientes`        |
| `BACKUP`           | `GERAR_BACKUP`| `POST /backup`                 |
| `RELATORIO`        | `EXPORTAR`    | `POST /reports/export/audit`   |
| `PDF_PRONTUARIO`   | `EXPORTAR`    | `GET /pdf/paciente/:id/prontuario` |
| `PDF_PRESCRICAO`   | `EXPORTAR`    | `GET /pdf/prescricao/:id`      |
| `PDF_ALTA`         | `EXPORTAR`    | `GET /pdf/alta/:id`            |

> Downloads sensíveis de PHI (PDFs clínicos) agora passam pela MESMA taxonomia
> unificada (`AuditExportService`), preservando as colunas indexadas
> `entity`/`entityId` (trilha de acesso por paciente) e ganhando `metadata` JSON.

---

## 2. Checklist E2E (browser) — validação final

Pré-requisitos: backend em `:3000` (Postgres migrado + seed), frontend em `:3001`,
`pg_dump` disponível no host do backend (para o teste de backup feliz).

### A. Autenticação & navegação
- [ ] Login com usuário **Recepcao** → menu mostra **Importar CSV** e **Exportação**;
      **não** mostra Auditoria/Relatórios sem permissão.
- [ ] Login com **Administrador** → mostra **Exportação** (seção pacientes),
      **sem** seção Backup.
- [ ] Login com **SuperAdmin** → **Exportação** mostra **somente** a seção Backup
      (a de pacientes fica oculta — SuperAdmin não tem hospital no contexto).
- [ ] Login com **Medico/Enfermeiro** → item **Exportação** ausente do menu; acesso
      direto a `/exportacao` mostra o card "sem acesso".

### B. Import CSV (regressão)
- [ ] Upload de CSV válido → resumo "Importado com sucesso" + prévia.
- [ ] Upload de CSV com erro → modo estrito: 0 gravados, tabela de erros.
- [ ] Auditoria: 1 evento `CSV_IMPORT` / `IMPORTAR` no tenant correto.

### C. Export pacientes (CSV/JSON)
- [ ] `Exportar CSV` → download de `pacientes-YYYY-MM-DD.csv`; abre no Excel com
      acentuação correta (BOM) e `;` como separador.
- [ ] `Exportar JSON` → download de `.json` com array válido.
- [ ] Abrir o CSV: célula iniciando com `=`/`+`/`-`/`@` vem prefixada com `'`
      (proteção contra CSV injection).
- [ ] Isolamento: o arquivo contém **apenas** pacientes do hospital logado.
- [ ] Auditoria: evento `PACIENTES_EXPORT` / `EXPORTAR` com `metadata.total_registros`.
- [ ] Rate limit: acionar o export acima do limite → UI mostra "Muitas
      solicitações" (429).

### D. Backup (SuperAdmin)
- [ ] `Gerar backup` com `pg_dump` disponível → indicador de progresso e download
      de `backup-*.sql`.
- [ ] Sem `pg_dump` no host (renomear/`PG_DUMP_PATH` inválido) → mensagem
      "Serviço indisponível… pg_dump não instalado" (503); **nenhum** arquivo baixado.
- [ ] Auditoria: evento `BACKUP` / `GERAR_BACKUP` (sucesso **e** falha registrados).
- [ ] Admin de hospital tentando `POST /backup` (via devtools) → 403.

### E. Relatórios + auditoria
- [ ] `CSV atendimentos` / `CSV exames` → download client-side.
- [ ] Auditoria: evento `RELATORIO` / `EXPORTAR` com o `relatorio` e `total_registros`.
- [ ] Filtro de período aplicado reflete no `total_registros` auditado.

### F. Rastreabilidade transversal
- [ ] Tela de **Auditoria** lista os eventos acima com usuário, módulo, operação,
      resultado e timestamp.
- [ ] Cada linha traz o `hospital_id` correto (RELATORIO/PACIENTES_EXPORT com
      tenant; BACKUP do SuperAdmin sem tenant).

> Status atual nesta entrega: verificação **estática** concluída (typecheck
> backend + frontend limpos; rota `/exportacao` compila e serve `HTTP 200`). O
> E2E autenticado acima depende de backend + Postgres no ar e deve ser executado
> no ambiente de homologação.

---

## 3. Recomendações de produção

1. **Throttler — unidade de `ttl`**: o `@nestjs/throttler` v6 usa **milissegundos**.
   O `THROTTLE_TTL` global default (`60`) resulta em janela de 60ms (≈ sem limite).
   Ajustar para `60000` em produção (o `.env.example` já foi atualizado; validar o
   `.env` real e o `env.ts`).
2. **Escopo do rate limit**: o `ThrottlerGuard` padrão limita por IP. Atrás de
   proxy/CDN, configurar `trust proxy` e/ou um `getTracker` por `userId` para não
   penalizar hospitais que compartilham egress NAT.
3. **Logs estruturados**: `logJson` já emite JSON por linha (apto a Loki/ELK).
   Encaminhar stdout/stderr ao coletor. Se optar por pino/winston, manter o mesmo
   shape (`timestamp, level, context, message, traceId`).
4. **Correlação por traceId**: o `TraceIdMiddleware` popula `req.traceId`. Propagar
   esse valor para dentro dos serviços de export/backup (via header ou
   AsyncLocalStorage) para amarrar log ↔ evento de auditoria.
5. **Backup fora do request HTTP**: para bases grandes, mover o `pg_dump` para um
   job assíncrono (fila) com destino em object storage — evita segurar a conexão
   HTTP por minutos e o teto de bytes.
6. **Retenção da trilha**: definir política de retenção/particionamento da tabela
   de auditoria (append-only tende a crescer) — LGPD exige guarda, mas com prazo.
7. **CORS**: fixar `CORS_ORIGINS` para o domínio do frontend (hoje default `*`).
8. **Limites coerentes**: revisar `EXPORT_MAX_ROWS`, `EXPORT_TIMEOUT_MS`,
   `BACKUP_MAX_BYTES` e `BACKUP_TIMEOUT_MS` conforme o porte de cada tenant.

---

## 4. Futuro (desenho — NÃO implementado)

### Exportação criptografada com link temporário (signed URL)

Objetivo: entregar exports de PII protegidos em repouso e em trânsito, com trilha
de acesso por paciente (LGPD), desacoplando a geração do download.

**Fluxo proposto**

```
Cliente ──(1) POST /export/pacientes/secure──▶ API
                                               │
                                               ├─(2) enfileira job (BullMQ/queue)
                                               │
Worker ◀───────────────────────────────────────┘
  ├─(3) stream keyset → cifra AES-256-GCM (chave por envelope, KMS)
  ├─(4) grava objeto em storage (S3/MinIO) com SSE + metadados
  └─(5) registra auditoria EXPORTAR (status=PENDENTE→CONCLUIDO)

Cliente ──(6) GET /export/jobs/:id──▶ status + signedUrl (expira em N min)
Cliente ──(7) GET signedUrl (storage) ──▶ download do arquivo cifrado
```

**Componentes**
- **Criptografia**: AES-256-GCM com **envelope encryption** — uma DEK por arquivo,
  cifrada por uma KEK gerenciada em KMS/HSM (nunca no código nem no banco). O IV/nonce
  e o auth tag acompanham o objeto. Chave/senha do arquivo entregue por canal
  separado (não junto do link).
- **Signed URL**: link com expiração curta (ex.: 5–15 min) e uso único quando o
  storage suportar; o backend nunca faz proxy do binário — o download vai direto ao
  storage.
- **Trilha de acesso do paciente (LGPD)**: cada geração e cada **download efetivo**
  gera evento de auditoria (`quem`, `quando`, `quais pacientes`/escopo, `job_id`,
  `ip`). Isso permite responder a titulares "quem acessou meus dados".
- **Estados do job**: `PENDENTE → PROCESSANDO → CONCLUIDO | FALHOU | EXPIRADO`,
  com limpeza automática (TTL) do objeto no storage após expiração.

**Integração com o que já existe**
- Reusa o `AuditExportService` (novo `status`/metadados: `job_id`, `expira_em`).
- Reusa a query keyset/tenant-safe do `ExportService` (isolamento por hospital).
- O `AccessAuditInterceptor` cobre o acesso a PHI; o download efetivo agrega o
  evento de "acesso ao export".

**Fora de escopo agora**: implementação da fila, do worker e da integração KMS —
apenas o desenho acima como norte para a próxima fase.
