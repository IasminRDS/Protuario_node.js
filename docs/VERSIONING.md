# Versionamento e Git Tags (governança)

Toda mudança que afete **comportamento, segurança, schema ou isolamento de
dados** segue SemVer e gera uma git tag anotada — **mas apenas após validação
real** (ver [gate](#-gate-de-validacao-nao-violar)).

---

## 🔢 Base de versão

O repositório está em:

| Tag | Marco |
| --- | --- |
| `v1.0.0` | primeira versão estável |
| `v1.1.0` | hybrid consistency model (F0.1–F0.6-C) |

👉 **Toda nova versão evolui a partir de `v1.1.0`.** Nunca voltar para `v0.x`
(seria regressão de SemVer sobre um `v1.0.0` já existente).

---

## 📐 Regras SemVer

- **MAJOR** → breaking change (contrato/API incompatível)
- **MINOR** → nova feature compatível (ex.: RLS **dormante**)
- **PATCH** → correção sem mudança de contrato

Formato: `vMAJOR.MINOR.PATCH` (ex.: `v1.2.0`). Sempre tag **anotada** (`-a`) com
o conteúdo técnico, impacto, condições de ativação e riscos conhecidos.

---

## 🚫 Gate de validação (NÃO VIOLAR)

**Nunca** criar uma tag se qualquer um for verdade:

- migrations não foram aplicadas (`prisma migrate deploy`);
- testes não passaram (`npm test` + `npm run test:e2e`);
- não houve execução em ambiente real (Node + Postgres).

Se não há ambiente para execução → **NÃO TAGUEAR**. Prefira gerar o artefato e
deixar o comando pronto para rodar após a validação.

> **Ambiente de validação canônico = CI.** O `.github/workflows/ci.yml` roda
> `prisma migrate deploy` + `npm run test:e2e` em todo PR para `main`. Portanto o
> gate é satisfeito por **CI verde no PR** do commit a ser tagueado — não exige
> Node/Postgres na máquina local.

Outras regras invioláveis:

- **Nunca** sobrescrever uma tag existente.
- **Nunca** usar nomes vagos (`latest`, `final`, `fix`).
- **Nunca** fazer `git push` de tag sem decisão explícita.

---

## 🧠 Estratégia: Dormant vs Active

Mudanças estruturais de segurança (ex.: RLS) são versionadas em **duas etapas**,
para separar *infra pronta* de *feature ativa* — o que preserva um ponto de
rollback exato entre "código presente" e "comportamento mudado":

1. **Dormant** (infra pronta, sem efeito em runtime) → um MINOR.
2. **Active** (runtime passa a depender da feature) → o MINOR seguinte.

---

## 📦 Convenções deste projeto — RLS

### RLS Fase 1 (dormant) → `v1.2.0`

Condição: só após `prisma migrate deploy` + `rls-phase1.e2e-spec.ts` **verdes**
(CI do PR serve como gate). Não fazer push automático.

```bash
git tag -a v1.2.0 -m "feat(security): RLS Phase 1 (dormant)

- Added role prontuario_app (NOSUPERUSER, non-owner)
- Enabled RLS on clinical tables (paciente, prontuario, atendimento, triagem, prescricao)
- Policies with USING + WITH CHECK (fail-closed)
- Runtime wiring behind RLS_ENABLED flag (default false)
- No behavior change yet (owner bypasses RLS; dormant until flip)

Activation (separate release):
- RLS_ENABLED=true
- DATABASE_URL -> prontuario_app

Known limitations:
- Reads return empty if GUC not set
- Super-admin temporarily scoped (fail-closed)
- auditoria excluded (would break ConsistencyMonitor global counts)"
```

### Ativação do RLS (flip de chave) → `v1.3.0`

Marca a **mudança real de comportamento**: o isolamento passa a ser enforcement
do banco (`RLS_ENABLED=true` + `DATABASE_URL` → `prontuario_app`).

### Correções no RLS → `v1.2.1`, `v1.2.2`, …

---

## 🎯 Objetivo

Rastreabilidade de segurança, rollback confiável e separação clara entre
**infra pronta** e **feature ativa**.

---

## 📒 Registro de versões

### [v1.2.0] — RLS Fase 1 (dormant) · **pendente de validação**

Status: **pending CI validation** — tag só após CI verde (migrations + `rls-phase1.e2e`).

- Policies RLS criadas nas 5 tabelas clínicas (USING + WITH CHECK), dormentes.
- Role `prontuario_app` (NOSUPERUSER, não-dona) + wiring atrás de `RLS_ENABLED`.
- Sem efeito em runtime (owner bypassa RLS até o flip).
- Ativação = release separado `v1.3.0`.

### [pendente] — Fase 6: vigilância, regulação, epidemiologia, MFA, offline UBS

Status: em validação local (migrations + e2e). Tag após merge com CI verde.

- **Schema** (migration `20260710000000_vigilancia_regulacao_mfa`):
  - tabela `notificacao_compulsoria` (SINAN — fichas por CID notificável);
  - `usuario.mfa_secret` / `usuario.mfa_enabled` (TOTP RFC 6238);
  - `encaminhamento` + colunas de regulação (`regulado_por`, `data_regulacao`,
    `parecer_regulacao`, `unidade_destino`) e novos status do fluxo SISREG-like.
- **Módulos novos**: `vigilancia` (gancho automático por CID em internação/alta/
  regulação), `regulacao` (fila + máquina de estados do regulador),
  `epidemiologia` (agregados do painel).
- **MFA**: step-up no login (desafio TOTP) + `MfaGuard` em export/backup
  (`MFA_ENFORCE_EXPORT`, default true — fail-closed p/ perfis administrativos).
- **Triagem**: DTO aceita classificação Manchester oficial (VERMELHO…AZUL) e o
  POST /triage ganhou idempotência (fila offline reenvia sem duplicar).
- **Frontend**: rotas `/vigilancia`, `/regulacao`, `/epidemiologia`, `/conta`;
  Manchester nas cores oficiais; PWA (manifest + SW) com fila offline IndexedDB.
