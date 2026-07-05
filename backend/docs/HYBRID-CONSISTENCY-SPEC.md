# PE-E2 — Spec-raiz do Modelo de Consistência Híbrida (F0.x)

> Contrato formal (não-código) do modelo de execução do backend. Define os
> domínios de consistência, suas fronteiras, as regras de não-interferência e os
> invariantes globais verificáveis. É a referência-raiz: qualquer PR que toque
> transação, auditoria, idempotência ou ordenação deve preservar este contrato.
> O checker de serializabilidade (Peça 2) valida **este** documento, não uma
> noção genérica de "serializable".

Status: os invariantes marcam **[PROVADO]** (com teste e2e citado) ou **[ABERTO]**.

---

## S0 — Taxonomia de eventos

Todo efeito observável do sistema pertence a **exatamente um** tipo:

| Tipo | Origem (código real) | Persistência |
|---|---|---|
| `MUTATION` | `pacientes.service` (create/update/soft-delete) | tabela de domínio, **na tx do request** |
| `AUDIT_SUCCESS` | `AuditoriaService.registrarTx` (F0.1) | `auditoria`, **na mesma tx** da MUTATION |
| `AUDIT_DENIAL` | `AuditoriaService.registrarAutonomo` (F0.3), via `access-audit.interceptor` (path de erro, **awaited**) | `auditoria`, **conexão autônoma** (`AuditPrismaService`) |
| `AUDIT_ACCESS_SUCCESS` | `access-audit.interceptor` (sucesso, **awaited**) → `registrarAcessoTx` (F0.5) | `auditoria`; **SOD** (`currentTx`) em mutação, `this.prisma` awaited em read — durável antes da resposta |
| `IDENTITY` | `crypto.randomUUID()` em todo audit (C6) → `auditoria.event_id` | atributo, único global |
| `CAUSAL_SEQ` | `AuditoriaService.nextAggregateSeq` (F0.4) → `auditoria.aggregate_seq` | atributo, monotônico por agregado |
| `IDEMPOTENCY` | `idempotency.interceptor` (`this.prisma`, claim atômico) | `idempotency_keys`, autônomo |

---

## S1 — Domínios de ordem

### Domínio A — SOD (Strong Order Domain) — *linearizável por request*
- **Escopo:** `MUTATION` + `AUDIT_SUCCESS` + `AUDIT_ACCESS_SUCCESS` (F0.5).
- **Fonte:** F0.1 (`runInTx`) + F0.2 (`TenantTxInterceptor` — 1 `$transaction` por request mutante; `currentTx()`).
- **Propriedades:** atomicidade (all-or-nothing), isolamento efetivo por request (READ COMMITTED do Postgres), rollback total, **tx única por request** (I1/I4).
- **Tempo:** *tx-time* — ordem total **por request**; commit atômico.

### Domínio B — COD (Causal Order Domain) — *ordem total por agregado*
- **Escopo:** o atributo `CAUSAL_SEQ` de eventos de auditoria que tenham `entity:entityId`.
- **Fonte:** F0.4 (`audit_aggregate_sequence`, `nextAggregateSeq`).
- **Propriedades:** por agregado `A`, `seq` é **total, monotônica e gapless**; agregados distintos são **independentes** (comutam). Não há ordem cross-aggregate (por design).
- **Tempo:** *seq-time* — relógio lógico por chave.

### Domínio C — EOD (Eventual Order Domain) — *convergência, não-bloqueante*
- **Escopo:** `AUDIT_DENIAL`, `IDEMPOTENCY`. *(F0.5 removeu `AUDIT_ACCESS` daqui.)*
- **Fonte:** F0.3 (`AuditPrismaService`) + idempotency store (`this.prisma`).
- **Propriedades:** commit independente (não participa da tx do request), sobrevive ao rollback do SOD, **ordem global não garantida** — apenas convergência.
- **Tempo:** *commit-time* real do Postgres (eventual).

> `IDENTITY` (event_id) é **identidade, não ordem** — atravessa todos os domínios; nunca é usado como relógio.

---

## S2 — Regras de não-interferência

**N1 — EOD não pode quebrar SOD.** Escritas EOD usam conexão própria (`this.prisma`/`auditPrisma`), **nunca `currentTx()`** → não podem forçar rollback nem entrar na tx do request.
*Verificável:* lint/grep — `auditPrisma` e o claim de idempotência nunca recebem `currentTx()`.

**N2 — SOD não pode bloquear em EOD.** O request (SOD) nunca aguarda um commit EOD para responder (denial/access são `void`/autônomos).
*Verificável:* nenhum `await registrarAutonomo` no caminho crítico que decide o resultado da tx.

**N3 — EOD nunca participa de invariante de domínio.** Nenhuma regra clínica lê o EOD store para decidir. (Idempotência decide **duplicação de request**, não estado clínico.)

**N4 — SOD é a única fonte de verdade transacional.** Leituras que alimentam decisões de domínio usam `currentTx() ?? prisma` (F0.2), nunca `auditPrisma`.

### ✅ D1 — RESOLVIDO como Opção B (COD puro + camada de correlação read-only)
Decisão tomada: **COD é SOD-only.** O `CAUSAL_SEQ` (membro da sequência causal) é
gerado **apenas** por `AUDIT_SUCCESS` (via `nextAggregateSeq`, que incrementa sob
lock, in-tx). Eventos EOD (`AUDIT_DENIAL`) **não incrementam** e **não adquirem o
lock** — recebem, via **`currentAggregateSeq` (SELECT read-only, MVCC)**, a última
posição **committada** do agregado como **correlação read-only** (`aggregate_seq`
= referência, não membro). Isto:
- **preserva N2:** EOD é não-bloqueante — um SELECT MVCC não espera o incremento
  não-committado de uma tx SOD em andamento;
- **mantém COD puro/gapless** (só eventos SOD são membros — o denial não consome seq);
- **preserva rastreabilidade:** o denial fica ancorado à posição committada do
  agregado no instante da negação.

Semântica do campo `aggregate_seq` por tipo:
- `AUDIT_SUCCESS` → **membro** do COD (`1..k`, monotônico, gapless).
- `AUDIT_DENIAL` (EOD) → **referência** de correlação (pode repetir o valor de um
  membro; **não** entra na verificação de I-G4/COD-checker).

---

## S3 — Invariantes globais verificáveis

**I-G1 — Toda MUTATION committada pertence a exatamente 1 SOD.**
Predicado: `∀ m committed : ∃! request r, m ∈ tx(r)`.
[PROVADO] `f02-tx-per-request` (I1/I4: 50 concorrentes → 50 tx distintas).

**I-G2 — Todo SOD-commit de mutação gera exatamente 1 `AUDIT_SUCCESS`.**
Predicado: `∀ o ∈ MUTATION_committed : |{a ∈ AUDIT_SUCCESS : corr(a,o)}| = 1` (bijeção).
[PROVADO] `f01-atomicity` (Caso B: falha no audit ⇒ rollback ⇒ estado (1,0) inalcançável; invariante count(paciente)==count(CRIAR)).

**I-G3 — Todo rollback por negação gera no máximo 1 `AUDIT_DENIAL`, e este SOBREVIVE ao rollback.**
Predicado: `∀ τ rolled-back-by-policy : |AUDIT_DENIAL(τ)| ≤ 1 ∧ AUDIT_DENIAL ∉ tx(τ)`.
[PROVADO] `audit-autonomous` (autônoma sobrevive ao rollback; falha isolada). *Cobertura:* hoje o path de negação é o do `access-audit.interceptor` para recursos PHI; negações fora dele (ex.: 400 de DTO **antes** da tx) não geram denial — e não precisam (nada foi tentado no banco).

**I-G4 — Para todo agregado A, `CAUSAL_SEQ` dos eventos `AUDIT_SUCCESS` é ordem total, monotônica e gapless.**
Predicado: `∀ A : {a.aggregate_seq : a ∈ AUDIT_SUCCESS(A)} = {1..k}`, sem repetição, sem buraco entre committados. Eventos `AUDIT_DENIAL` (EOD) carregam `aggregate_seq` como **referência** e **não** entram neste conjunto.
[PROVADO] `f04-causal-order` (N updates concorrentes → {1..N+1}; independência cross-agregado; gapless sob rollback) + `f04-d1b` (denial não incrementa; referência read-only não-bloqueante).

**I-G5 — Replay idempotente não cria novo SOD.**
Predicado: `∀ requests r1,r2 com mesma Idempotency-Key e mesmo corpo : |MUTATION| = 1`.
[PROVADO] `idempotency` (5 concorrentes mesma chave → 1 paciente, 5×201 mesmo id) + `idempotency-claim` (claim atômico → 1 execução).

**I-G6 — WORM: nenhum evento de auditoria é alterado/removido.**
Predicado: `∀ a ∈ auditoria : UPDATE(a) ∨ DELETE(a) ⇒ erro`.
[PROVADO] `auditoria-worm` (42501 em UPDATE/DELETE).

**I-G7 — IDENTITY única e server-side.**
Predicado: `∀ a,b : a.event_id = b.event_id ⇒ a=b`; nunca derivada do cliente.
[PROVADO] `event-id` (constraint UNIQUE + cliente não controla).

**I-G8 — ACCESS DURABILITY (F0.5).** Todo acesso auditável (leitura sensível / ação de super-admin / mutação PHI) gera **exatamente 1** `AUDIT_ACCESS_SUCCESS` **durável antes da resposta** — nenhum fire-and-forget.
Predicado: `∀ access_op auditável : ∃! a ∈ AUDIT_ACCESS_SUCCESS : a.requestId = access_op.requestId ∧ committed(a) precede response`.
[PROVADO] `f05-access-durability` (bijeção N acessos → N; sob rollback de mutação o access-audit da mutação reverte junto (SOD); read audita antes da resposta; zero `tap`/fire-and-forget).

---

## S4 — Propriedade de consistência híbrida

O sistema **não é serializável globalmente** — e isso é **intencional**. Ele é
**decomponivelmente serializável por domínio**:

```
System = SOD ⊕ COD ⊕ EOD
  SOD = linearizável por request        (forte)
  COD = ordem total por agregado        (causal, per-key)
  EOD = convergência eventual           (não-ordenado global)
```

Consequências formais:
- **Isolamento efetivo:** READ COMMITTED. Anomalias de RC (read-skew / write-skew / phantom) são **evitadas por constraint** (`cpf UNIQUE`, `@@unique([profissionalId,data,hora])` RN-011), não por isolamento. `SERIALIZABLE` só é obrigatório se surgir invariante cross-row **sem** constraint (S6-D2).
- **Dirty read não existe** (garantia do RC) — não é invariante da aplicação.
- **Não-repúdio** vive em SOD (sucesso, atômico) + EOD (negação, durável) — nunca depende de EOD para a **decisão**, só para a **evidência**.

---

## S5 — Escopo do checker de serializabilidade (Peça 2)

Com a spec, o conflict-graph checker tem **alvo definido** e vira trivial de interpretar:

- **SOD-checker:** sobre a história de um request, monta grafo de conflito (WR/WW/RW) e assere **aciclicidade por request** (linearização local).
- **COD-checker:** sobre a história de um agregado, restrito a `AUDIT_SUCCESS`, assere **ordem total sem ciclo** (equivalente a I-G4, mas via grafo). Eventos `AUDIT_DENIAL` (referência) são **excluídos**.
- **EOD:** **excluído** do grafo (por design não é ordenado globalmente — incluí-lo gera falso-positivo).

Cada ciclo detectado tem interpretação semântica única (SOD ⇒ bug de isolamento por request; COD ⇒ bug de sequência). Sem esta spec, o grafo misturaria domínios incompatíveis e produziria falsos-positivos.

---

## S6 — Decisões em aberto

- **D1 (COD↔EOD): ✅ RESOLVIDO — Opção B** (COD SOD-only; EOD recebe correlação read-only não-bloqueante via `currentAggregateSeq`). Ver §S2.
- **D2 (SERIALIZABLE):** adotar `ISOLATION LEVEL SERIALIZABLE` + retry `40001` no `TenantTxInterceptor` **apenas** quando surgir invariante cross-row sem constraint. Hoje: não.
- **D3 (normalização de agregado):** audit de domínio usa `entity='paciente'` (singular), audit de acesso usa `resource='pacientes'` (plural) → chaves de agregado distintas. Normalizar para uma chave canônica se a timeline unificada for requisito.
- **D4 (F0.5 durabilidade): ✅ RESOLVIDO.** `AUDIT_ACCESS_SUCCESS` promovido de EOD→SOD: awaited-durável antes da resposta (in-tx em mutação; `this.prisma` awaited em read). Fire-and-forget eliminado (incl. denial agora awaited-autônomo). Custo aceito: +1 escrita síncrona no caminho de acessos auditáveis (só endpoints sensíveis; reads públicos não auditados).

---

## Mapa código ⇄ spec (âncoras)

| Conceito | Arquivo |
|---|---|
| SOD boundary | `shared/interceptors/tenant-tx.interceptor.ts`, `shared/tenant/tenant-context.ts` (`currentTx`) |
| SOD atomicidade | `modules/pacientes/pacientes.service.ts` (`runInTx`), `modules/auditoria/auditoria.service.ts` (`registrarTx`) |
| COD | `nextAggregateSeq` + `audit_aggregate_sequence` (migration `..._audit_causal_order`) |
| EOD (denial) | `modules/auditoria/audit-prisma.service.ts`, `registrarAutonomo` |
| EOD (idempotência) | `shared/interceptors/idempotency.interceptor.ts` |
| IDENTITY | `event_id` (migration `..._auditoria_event_id`) |
| WORM | migration `..._auditoria_worm` |
