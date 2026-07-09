# Operações — Ambiente, Build e Validação

Guia determinístico para evitar os "404 fantasma" (rota que existe no código mas
não no processo) e para validar o fluxo de importação CSV ponta a ponta.

---

## 1. Hardening de ambiente (anti-404 fantasma)

`Cannot GET /rota` = **404 do roteador Express** = a instância **em execução** não
tem o controller mapeado. Quase sempre a causa é **build/instância**, não código.

### Checklist antes de subir

1. **Um build por vez, sempre limpo.** O script `build` já roda `prebuild` que
   apaga `dist/` antes de compilar (evita `dist` desatualizado):
   ```bash
   cd backend && npm run build      # limpa dist/ e recompila
   ```
2. **Prod roda o build atual — nunca um `dist` velho:**
   ```bash
   npm run start:fresh              # prisma generate + build limpo + start:prod
   # (ou, em dev, use start:dev — ts-node reflete o código atual, imune a dist velho)
   ```
3. **Sem processos duplicados na porta.** Antes de subir, mate o que estiver na porta:
   ```bash
   # Windows (PowerShell):
   Get-NetTCPConnection -LocalPort 3000 -State Listen |
     ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   # Linux/macOS:
   lsof -ti:3000 | xargs -r kill -9
   ```
4. **Porta consistente entre front e back.** O front usa `NEXT_PUBLIC_API_URL`
   (default `http://localhost:3000/api/v1`). Se a `:3000` estiver ocupada (ex.: proxy
   do Docker Desktop no Windows), suba o back em outra porta (`PORT=3010`) **e**
   ajuste `frontend/.env.local` para a mesma porta.
5. **Confirme as rotas no log do boot.** Devem aparecer linhas como:
   ```
   Mapped {/api/pronto-socorro/fila, GET} (version: 1)
   Mapped {/api/internacao/leitos, GET} (version: 1)
   ```
   Se não aparecem → o processo é build velho: refaça o passo 1–2.

### `node_modules` quebrado (erros "Cannot find module '@nestjs/common'"...)

Sintoma: `nest build` falha com centenas de `Cannot find module`. Reset limpo:

```bash
# na RAIZ do monorepo (workspaces):
node -e "require('fs').rmSync('node_modules',{recursive:true,force:true})"
node -e "require('fs').rmSync('backend/node_modules',{recursive:true,force:true})"
node -e "require('fs').rmSync('frontend/node_modules',{recursive:true,force:true})"
npm install
cd backend && npx prisma generate && npm run build
```

### Dev vs Prod (resumo)

| | Dev | Prod |
|---|---|---|
| Comando | `npm run start:dev` | `npm run start:fresh` |
| Fonte | ts-node (sempre atual) | `dist/` compilado |
| Risco de `dist` velho | nenhum | eliminado pelo `prebuild` + `start:fresh` |
| Prisma client | garanta `prisma generate` após mudar schema | incluído no `start:fresh` |

---

## 2. Validação E2E do CSV (determinística)

Pré-requisito: PostgreSQL de teste + migrations + seed aplicados; backend no ar.
Um script pronto executa todos os cenários e valida banco + ImportLog:

```bash
# backend no ar (ex.: :3011) e Postgres migrado+seedado
node scripts/e2e-csv.mjs --base http://localhost:3011/api/v1 --login gestor --senha Gestor@123
```

Passo a passo (o que o script cobre):

1. **Subir backend** e autenticar como usuário com `patient:create`
   (Administrador/Recepção; **não** Médico/Enfermeiro).
2. **Subir frontend** e abrir `/importacao` (RBAC `<Can perm="patient:create">`).
3. **CSV válido** → `sucesso=true`, `validos=N`, pacientes inseridos.
4. **CSV inválido** (1 CPF ruim) → `sucesso=false`, erro na linha, **nada inserido**
   (modo STRICT: contagem de pacientes não muda).
5. **CSV duplicado** (CPF já existente) → linha marcada "CPF já cadastrado".
6. **UI**: prévia (5 primeiras linhas) e tabela de erros (linha | erro) renderizadas.
7. **Banco**: `SELECT count(*) FROM paciente` antes/depois confirma insert/rollback.
8. **ImportLog**: `SELECT filename,total_linhas,validos,invalidos,sucesso FROM import_log`
   tem uma linha por tentativa (sempre gravado, sucesso ou falha).

Formato do CSV: `nome;cpf;data_nascimento;sexo` (ex.: `Maria Silva;52998224725;1990-05-10;F`).

---

## 3. Backup do banco (`POST /api/v1/backup`)

- **Somente SuperAdmin** (operador da plataforma): `pg_dump` é global (todos os
  tenants), então não é exposto a admins de hospital.
- Requer o binário `pg_dump` no servidor (`PG_DUMP_PATH` para caminho customizado).
- Streaming (não carrega em memória), com timeout (`BACKUP_TIMEOUT_MS`) e limite de
  tamanho (`BACKUP_MAX_BYTES`). Toda execução é auditada (LGPD).
- Formatos: `?format=sql` (texto) ou `?format=dump` (custom, para `pg_restore`).

```bash
curl -X POST "http://localhost:3000/api/v1/backup?format=sql" \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" -o backup.sql
```
