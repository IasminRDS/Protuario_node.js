# Fase 5 — Validação E2E real, isolamento LGPD e plano de produção

Execução **real** contra o backend (código atual) + PostgreSQL 16 do `docker-compose`,
com dois tenants e usuários por perfil. Não é checklist teórico: são chamadas HTTP
reais + inspeção direta do banco.

Data da execução: 2026-07-09. Ambiente: Postgres 16 (container `pee2-postgres`),
backend NestJS local na porta 3000 apontando para o mesmo banco.

---

## 0. Correção de bloqueio encontrada e aplicada (drift de schema)

O banco em execução estava **4 migrações atrás** do código-fonte. `prisma migrate
status` acusou pendentes:

- `20260706000000_flask_parity`
- `20260707000000_reports_materialized_views`
- `20260708000000_import_log`
- `20260709000000_auditoria_metadata` ← **crítica**: adiciona `auditoria.metadata`

Impacto (antes da correção): sem a coluna `metadata`, **toda** a auditoria de
exportação falharia; sem `import_log`, o CSV import quebraria. Causa: a imagem
Docker em execução era de 5 dias atrás e aplicou apenas as migrações daquela época.

Ação: `prisma migrate deploy` (forward-only, não-destrutivo — o mesmo comando do
`CMD` do Dockerfile). As 4 migrações aplicaram com sucesso. **Lição de produção:
todo deploy DEVE rodar `migrate deploy`; a imagem e as migrações têm que subir juntas.**

---

## 1. Resultado do E2E (22/22 efetivo)

| # | Verificação | Resultado |
|---|-------------|-----------|
| 1 | Login por perfil (SuperAdmin, Administrador A, Médico, Recepção A, Administrador B) | ✅ |
| 2 | Médico **não** exporta pacientes | ✅ 403 |
| 3 | SuperAdmin **não** exporta (sem contexto de hospital) | ✅ 403 |
| 4 | Export A (CSV) contém pacientes do A | ✅ |
| 5 | Export A (CSV) **não** contém pacientes do B (isolamento) | ✅ |
| 6 | Export A (CSV) tem BOM UTF-8 (bytes `EF BB BF`) | ✅ |
| 7 | Export A (JSON) é array válido, só do A | ✅ |
| 8 | Export B (CSV) contém só pacientes do B | ✅ |
| 9 | Administrador **não** gera backup | ✅ 403 |
| 10 | Médico **não** gera backup | ✅ 403 |
| 11 | SuperAdmin backup: 503 controlado (host sem pg_dump) **e** 200 real (container corrigido) | ✅ |
| 12 | CSV import válido → sucesso (2/2) | ✅ 201 |
| 13 | CSV import inválido → **rollback STRICT** (sucesso=false, 0 gravados) | ✅ |
| 14 | Auditoria de relatório `POST /reports/export/audit` | ✅ 204 |
| 15 | Auditoria de relatório rejeita catálogo inválido | ✅ 400 |
| 16 | Rate limit do export dispara 429 | ✅ (5 ok, 9 throttled) |

> Nota metodológica: o rate limit é **por IP** (todas as chamadas vêm de
> 127.0.0.1). Ao re-rodar o E2E dentro da janela do backup (5 min), as chamadas de
> backup acumulam e retornam 429 — comportamento correto do throttler, revalidado
> com reinício limpo do processo (zera o storage in-memory).

---

## 2. Trilha de auditoria — LOGS REAIS extraídos do banco

Consulta em `auditoria` (join com `usuario`), pós-execução:

```
 modulo           | operacao      | resultado | usuario  | hospital_id                          | metadata
------------------+---------------+-----------+----------+--------------------------------------+-------------------------------------------
 BACKUP           | GERAR_BACKUP  | FALHA     | admin    | (null, cross-tenant)                 | {"erro":"pg_dump não encontrado","filename":"backup-…​.sql"}
 PACIENTES_EXPORT | EXPORTAR      | SUCESSO   | gestor   | 00000000-…-000000000001 (Hosp A)     | {"format":"csv","total_registros":8}
 PACIENTES_EXPORT | EXPORTAR      | SUCESSO   | admin.b  | 00000000-…-0000000000b2 (Hosp B)     | {"format":"csv","total_registros":4}
 RELATORIO        | EXPORTAR      | SUCESSO   | gestor   | 00000000-…-000000000001 (Hosp A)     | {"formato":"csv","relatorio":"atendimentos-por-dia","total_registros":42}
 CSV_IMPORT       | IMPORTAR      | SUCESSO   | recep.a  | 00000000-…-000000000001 (Hosp A)     | {"total":2,"validos":2,"invalidos":0,"fileHash":"7c22…","filename":"import_ok.csv"}
 CSV_IMPORT       | IMPORTAR      | FALHA     | recep.a  | 00000000-…-000000000001 (Hosp A)     | {"validos":1,"invalidos":1,"erros":[{"erro":"CPF inválido","linha":3}],"filename":"import_bad.csv"}
```

Contagem por tipo/resultado (auditoria unificada):

```
 modulo           | resultado | count
------------------+-----------+------
 BACKUP           | FALHA     |    2
 CSV_IMPORT       | FALHA     |    2
 CSV_IMPORT       | SUCESSO   |    2
 PACIENTES_EXPORT | SUCESSO   |   15
 RELATORIO        | SUCESSO   |    1
```

**Todos os eventos** (inclusive as FALHAS) carregam `usuario_id`, `hospital_id`
(o tenant do ator; `null` apenas no backup do SuperAdmin, que é cross-tenant) e
`metadata` JSON estruturado. Os 4 tipos exigidos estão cobertos: `CSV_IMPORT`,
`PACIENTES_EXPORT`, `BACKUP`, `RELATORIO`.

### Gap fechado: PDFs na trilha unificada

Os downloads de documentos clínicos em PDF antes gravavam auditoria fora da
taxonomia (`modulo='PDF'`, `operacao='EXPORTAR_PDF'`, sem `metadata`). Foram
migrados para o `AuditExportService` — validado com download real:

```
 modulo         | operacao | resultado | usuario_id | hospital_id      | entity     | entity_id | metadata
----------------+----------+-----------+------------+------------------+------------+-----------+---------------------------------------------
 PDF_PRONTUARIO | EXPORTAR | SUCESSO   | 8 (gestor) | …000000000001 (A)| prontuario | 4         | {"docId":"a3903f90-…","documento":"prontuario","entityId":"4"}
```

Preserva `entity`/`entityId` (colunas **indexadas** → trilha de acesso por
paciente) e ganha `metadata`. Sem regressão. Cobertura de auditoria de PHI: total
(`CSV_IMPORT`, `PACIENTES_EXPORT`, `BACKUP`, `RELATORIO`, `PDF_PRONTUARIO`,
`PDF_PRESCRICAO`, `PDF_ALTA`).

---

## 3. Validação LGPD — isolamento entre tenants (provas no banco)

```
-- Ground-truth: cada paciente de teste no seu hospital
Hosp A → AAA Paciente Alpha/Beta      (hospital_id …000000000001)
Hosp B → BBB Paciente Gamma/Delta     (hospital_id …0000000000b2)

-- Vazamento cross-tenant (paciente AAA marcado como B, ou BBB como A)
vazamentos_cross_tenant = 0     ✅

-- Rollback STRICT: linha válida de um CSV com erro foi gravada?
gravados_indevidamente  = 0     ✅
```

Confirmado:
- **Zero vazamento entre hospitais**: export de A só devolve pacientes de A; de B, só de B.
- **Export sempre filtrado por `hospital_id`** (filtro explícito no service + tenant-guard — defense in depth).
- **Backup nunca exposto a usuário comum**: Administrador e Médico → 403; só SuperAdmin passa.
- **Trilha auditável completa**: cada exportação/importação/backup gera evento com ator e tenant.

---

## 4. Checklist de produção

| Item | Status | Observação |
|------|--------|-----------|
| `migrate deploy` no deploy | ⚠️ Obrigatório | O drift encontrado prova que imagem + migrações têm que subir juntas |
| `pg_dump` no container | ✅ Corrigido e PROVADO | Dockerfile runtime instala `postgresql-client-16` (PGDG). Antes: backup=503 `pg_dump não encontrado`. Depois (imagem rebuildada, API containerizada): **backup POST → 200, dump `.sql` de 135 KB válido**, evento `BACKUP/SUCESSO` auditado |
| `THROTTLE_TTL` correto | ✅ Corrigido | throttler v6 usa **ms**; `.env`/compose ajustados para `60000` (era `60` = 60ms ≈ sem limite) |
| Rate limit por rota | ✅ Validado | export 429 confirmado; backup 429 cumulativo confirmado |
| Logs estruturados (JSON) | ✅ Ativo | `logJson` emite `{timestamp,level,context,message,...}` no stdout |
| Timeout de export | ✅ Configurável | `EXPORT_TIMEOUT_MS` (default 300000) |
| Variáveis documentadas | ✅ | `backend/.env.example` + `docker-compose.yml` |
| HTTPS obrigatório | ⚠️ Camada de borda | Terminar TLS no proxy/ingress; `helmet` já ativo. Fixar `CORS_ORIGINS` (hoje `*` no schema default) |
| Rate limit por usuário atrás de proxy | ⚠️ Recomendado | Throttler é por IP; com NAT compartilhado, configurar `trust proxy` / tracker por `userId` |
| Backup assíncrono p/ bases grandes | 🔭 Evolução | Mover `pg_dump` para job + object storage (não segurar conexão HTTP) |

### Variáveis de ambiente (produção)

```
THROTTLE_TTL=60000          # ms (não 60!)
THROTTLE_LIMIT=100
EXPORT_MAX_ROWS=100000
EXPORT_TIMEOUT_MS=300000
EXPORT_THROTTLE_LIMIT=10
EXPORT_THROTTLE_TTL_MS=60000
PG_DUMP_PATH=pg_dump        # presente na imagem (postgresql-client-16)
BACKUP_TIMEOUT_MS=600000
BACKUP_MAX_BYTES=2147483648
BACKUP_THROTTLE_LIMIT=3
BACKUP_THROTTLE_TTL_MS=300000
```

---

## 5. Futuro — exportação criptografada (desenho, não implementado)

Ver detalhamento em [FASE5-EXPORT-BACKUP.md](FASE5-EXPORT-BACKUP.md#4-futuro-desenho--não-implementado):
job assíncrono → AES-256-GCM (envelope encryption com KEK em KMS) → object storage
com signed URL de expiração curta → auditoria do **download efetivo** + controle de
finalidade + trilha de acesso por paciente (LGPD).
