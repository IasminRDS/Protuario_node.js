# Arquitetura do Sistema Nacional de Prontuário Eletrônico (SNPE)

> Documento de arquitetura de nível governamental. Evolui o backend PE-E2
> (NestJS + Prisma + PostgreSQL) para uma plataforma federal, multi-região,
> event-driven, com auditoria criptograficamente verificável e escala de 100M+
> cidadãos. Estratégia de evolução: **Strangler Fig** (nada é reescrito do zero).

---

## 0. Sumário de decisões (ADRs resumidos)

| # | Decisão | Justificativa |
|---|---|---|
| ADR-01 | **Modular monolith evolutivo → microservices por extração** | Evita complexidade distribuída prematura; extrai só o que exige escala/isolamento independente. |
| ADR-02 | **Arquitetura celular por macro-região (cells)** | Isola falha regional; segrega dados por UF; escala horizontal linear. |
| ADR-03 | **Event sourcing no núcleo clínico (Prontuário)** + CRUD no resto | Fonte da verdade imutável e auditável para dados clínicos; CRUD onde ES não agrega valor. |
| ADR-04 | **Transactional Outbox + Kafka (RF=3, acks=all)** | Zero perda de dado clínico e publicação de evento atômica com a transação. |
| ADR-05 | **MPI (Master Patient Index) como serviço de identidade federada** | Prontuário único nacional exige deduplicação determinística + probabilística. |
| ADR-06 | **Auditoria append-only com hash-chain + ancoragem periódica** | Auditoria criptograficamente verificável (não-repúdio). |
| ADR-07 | **Consistência forte intra-contexto, eventual controlada inter-região** | Teorema CAP: priorizar disponibilidade e partição-tolerância na federação. |
| ADR-08 | **Crypto-shredding para conciliar imutabilidade × LGPD (esquecimento)** | Apagar a chave torna o dado ilegível sem violar o append-only. |
| ADR-09 | **Zero Trust + mTLS + OAuth2 (gov.br) + RBAC/ABAC** | Segurança nível governo, contexto (UF/unidade/finalidade) na autorização. |
| ADR-10 | **Edge/UBS offline via event log local + sincronização por outbox** | Eventos clínicos são aditivos → sincronização sem conflito destrutivo. |

---

## 1. Arquitetura completa (visão)

```
                         ┌─────────────────────────────────────────────┐
   Cidadão / gov.br ───▶ │        IdP (gov.br OAuth2/OIDC) + MFA         │
                         └─────────────────────────────────────────────┘
                                            │ JWT
   Web (Next.js) ─┐                         ▼
   Mobile (RN)  ──┼──────▶ ┌───────────────────────────────┐
   UBS Edge     ──┘        │        API GATEWAY (Kong)      │  rate limit global,
   Sist. externos ───────▶ │   /api/v1  authN/Z, WAF, mTLS  │  roteamento, traceId
                           └───────────────┬───────────────┘
                                           │  (mTLS, zero trust)
        ┌──────────────┬──────────────┬────┴─────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐
   │  MPI /  │   │ Atendim. │  │ Prontuário│  │  Estoque  │  │ Auditoria│  │ Notif./  │
   │Identidade│  │  (CRUD)  │  │(EventStore│  │  (CRUD +  │  │(hash-chn │  │ Integr.  │
   │ Cidadão │   │          │  │  + CQRS)  │  │  saga)    │  │  WORM)   │  │ (FHIR)   │
   └────┬────┘   └────┬─────┘  └─────┬─────┘  └────┬──────┘  └────┬─────┘  └────┬─────┘
        │             │              │             │              │             │
        └─────────────┴──────────────┴─────Transactional Outbox───┴─────────────┘
                                           │
                                   ┌───────▼────────┐
                                   │  KAFKA (bus)   │  tópicos versionados,
                                   │ event streaming│  particionados por UF/cidadão
                                   └───────┬────────┘
                    ┌──────────────────────┼───────────────────────┐
                    ▼                      ▼                        ▼
            ┌───────────────┐     ┌────────────────┐       ┌────────────────┐
            │ Read Models   │     │ BullMQ Workers │       │ Sync federativa│
            │ (CQRS/consulta│     │ (PDF, e-mail,  │       │ (região↔nacional│
            │  longitudinal)│     │  reprocess.)   │       │  eventual cons.)│
            └───────────────┘     └────────────────┘       └────────────────┘

  Persistência por CELL (macro-região): PostgreSQL (Patroni/HA, replicação síncrona
  intra-região) + Redis + Object Storage WORM. Observabilidade: OTel→Tempo/Prometheus/Loki→Grafana.
  Orquestração: Kubernetes (HPA, multi-AZ, multi-região).
```

**Camadas lógicas** (mantidas do PE-E2): Controller → Service → Repository → Domain, agora com uma camada **Events** (publish/consume via Outbox) por contexto.

---

## 2. Monólito modular vs microservices — decisão justificada

**Decisão: modular monolith evolutivo, com extração seletiva para microservices (ADR-01).**

Não se começa um sistema nacional com 15 microservices no dia 1 — isso importa toda a complexidade distribuída (rede, consistência, deploy, observabilidade) antes de existir carga que a justifique, e é a causa nº 1 de falha em projetos gov. Também não se opera em escala nacional com um monólito único (ponto único de falha, deploy acoplado, escala grosseira).

**Caminho:**
1. **Fase 1 — Modular monolith** (o PE-E2 atual): módulos com fronteiras rígidas, sem imports cruzados entre domínios exceto por interfaces/eventos. Um schema Postgres por domínio (`auth`, `clinico`, `estoque`, `auditoria`...). Já preparado para extração.
2. **Fase 2 — Extração dos contextos de maior pressão**, na ordem de necessidade:
   - **MPI/Identidade do Cidadão** — precisa ser global e único (não pode ficar preso a uma célula regional).
   - **Auditoria** — precisa isolamento, WORM e regras de acesso próprias.
   - **Prontuário (Event Store + read models)** — maior volume de leitura longitudinal.
   - **Estoque** — cargas e picos independentes (campanhas de vacinação).
3. **Fase 3 — Demais contextos** conforme métricas (latência, throughput, blast radius).

**Critério objetivo de extração:** um módulo vira serviço quando ≥2 forem verdadeiros: (a) exige escala independente; (b) tem SLA/criticidade distinta; (c) ciclo de release próprio; (d) fronteira de dados/segurança distinta; (e) time dedicado. Caso contrário, permanece módulo — acoplamento in-process é mais barato e confiável que RPC.

---

## 3. Modelo de dados nacional

### 3.1 Identidade federada (o problema central)
`Cidadao` ≠ `Paciente`. **Cidadão** é a identidade nacional única (chave lógica CPF + CNS, resolvida pelo MPI). **Paciente** é a representação clínica local em cada célula/unidade, sempre apontando para um `cidadaoId` global (UUID nacional emitido pelo MPI).

```
Cidadao (MPI, global)                     Paciente (regional)
  id (UUID nacional)  ◀───────────────────  cidadaoId (FK lógica global)
  cpf (único, tokenizado)                    unidadeId
  cns[] (pode ter múltiplos históricos)      dados demográficos locais
  status (ativo/óbito/unificado)             ...
  golden_record (dados mestres)
  merge_history[] (auditável)
```

### 3.2 Núcleo clínico como Event Store
```
ClinicalEvent (append-only, source of truth)
  id (UUID)              streamId (cidadaoId)     seq (ordem por stream)
  type (versionado)      payload (cifrado)         occurredAt / recordedAt
  actor (profissional)   unidadeId / uf            finalidade (LGPD)
  prevHash / hash        signature                 schemaVersion
```
Tipos: `PacienteCriado`, `AtendimentoRealizado`, `PrescricaoEmitida`, `ExameSolicitado`, `ExameLiberado`, `VacinaAplicada`, `InternacaoCriada`, `AltaHospitalar`, `EstoqueMovimentado`, `AcessoProntuario`.

O **Prontuário Nacional** é um *read model* (projeção CQRS) derivado dos eventos do stream do cidadão — reconstruível, com snapshots periódicos para performance.

### 3.3 Contextos CRUD (Prisma/Postgres, por célula)
`Usuario`, `Perfil`, `UnidadeSaude`, `Agenda`, `Triagem`, `Atendimento`, `Prescricao`, `Exame`, `Internacao`, `Vacinacao`, `Produto`, `MovimentacaoEstoque`, `Auditoria`. Todos com `uf`/`unidadeId` para segregação, soft delete e campos de auditoria (`created/updated/deleted _at/_by`).

### 3.4 Particionamento
- **Sharding por UF** (ou macro-região) no nível de célula; dentro da célula, particionamento de tabelas quentes por hash de `cidadaoId` e por range de tempo (`clinical_event`, `auditoria`).
- **Estoque** particionado por `unidadeId` (rastreabilidade por UF).

---

## 4. Fluxo de eventos clínicos (event-driven core)

Exemplo — **Atendimento com prescrição e baixa de estoque** (saga coreografada):

```
1. Atendimento.finalizar()  ─(TX local)─▶ grava Atendimento + linha na OUTBOX
2. Relay publica ▶ Kafka: AtendimentoRealizado.v1
3. Prontuário consome ▶ anexa evento ao stream do cidadão (Event Store) ▶ atualiza read model
4. Prescricao consome/emite ▶ PrescricaoEmitida.v1
5. Estoque consome PrescricaoEmitida ▶ valida saldo ▶ EstoqueMovimentado.v1
        └─ falha de saldo ▶ EstoqueRejeitado.v1 ▶ compensação (alerta clínico, não bloqueia atendimento já concluído)
6. Auditoria consome TODOS ▶ append hash-chain
7. Notificação consome ▶ integra FHIR / avisa gestor
```

**Garantias:**
- **Publicação atômica:** *Transactional Outbox* — o evento é gravado na mesma transação do dado; um relay (Debezium/poller) publica no Kafka. Sem outbox, há a janela clássica "gravou no banco mas caiu antes de publicar" = perda de evento.
- **Idempotência:** consumidores usam `eventId` + tabela de dedupe (exactly-once efetivo).
- **Ordenação:** partição Kafka por `cidadaoId` garante ordem por stream clínico.
- **Versionamento:** todo evento tem `schemaVersion`; upcasters convertem versões antigas.
- **Verificabilidade:** cada evento é assinado (chave da unidade) e encadeado por hash.

---

## 5. Estratégia de sincronização federativa

**Arquitetura celular (ADR-02):** o país é dividido em **células** (por macro-região/UF). Cada célula tem sua stack completa (K8s, Postgres HA, Kafka, Redis) e é autônoma — falha de uma não derruba as outras.

- **Identidade é global, dado clínico é regional.** O MPI é o único componente verdadeiramente nacional (replicado multi-região, leitura local + escrita coordenada). Ele resolve `cidadaoId` e evita duplicação entre estados (regra inegociável nº 1).
- **Consistência (ADR-07):** forte **dentro** da célula (Postgres com replicação síncrona intra-região); **eventual controlada** **entre** células e para o nível nacional. O Prontuário Nacional consolidado é um read model alimentado por replicação de eventos Kafka (MirrorMaker) entre células → hub nacional.
- **Cidadão em trânsito** (atendido fora da UF de origem): a célula local consulta o MPI (identidade) e solicita a projeção longitudinal do cidadão ao hub nacional (read-through cache). O novo atendimento nasce na célula local e replica de volta.
- **Latência de sincronização** é um SLO explícito (ex.: p99 < 60s para propagação nacional), com painel e alerta. Assume-se e comunica-se que a visão nacional é *eventualmente* consistente — o cuidado imediato usa o dado local.

### Operação offline (UBS remotas — regra nº 6)
- Edge roda um subconjunto (cadastro, atendimento, triagem, vacinação) com **event log local** (SQLite/embedded) + outbox.
- Como eventos clínicos são **aditivos** (não sobrescrevem), a reconciliação é *append* — sem conflito destrutivo. Ordenação por **HLC (Hybrid Logical Clock)** para timeline consistente.
- Ao reconectar, o outbox drena para a célula regional; dedupe por `eventId`. Identidade offline usa cache do MPI + fila de resolução para casos novos/ambíguos.

---

## 6. Segurança LGPD nível governo

- **AuthN:** OAuth2/OIDC via **gov.br** como IdP federado; JWT de acesso curto + refresh rotativo; **MFA obrigatório** para perfis críticos (médico, admin, auditor) e para *break-glass*.
- **AuthZ:** **RBAC + ABAC** — papel (Médico, Enfermeiro...) **e** contexto (UF, unidade, vínculo com o atendimento, **finalidade** declarada). Ex.: um médico só acessa o prontuário nacional de um cidadão mediante finalidade assistencial registrada (log de acesso com finalidade — regra nº 5).
- **Break-glass:** acesso emergencial fora do vínculo normal é permitido mas gera auditoria de severidade máxima + notificação ao DPO.
- **Criptografia:** TLS 1.3 em trânsito; **mTLS** entre serviços (zero trust); AES-256 em repouso; **field-level encryption** para dados ultrassensíveis; **tokenização de CPF** (o CPF real fica num vault; serviços trafegam token).
- **Segregação por UF** aplicada na camada de dados (row-level security no Postgres + filtro ABAC no gateway).
- **Anti-exfiltração:** rate limiting global + por serviço + por usuário; detecção de acesso anômalo (volume/horário atípico → alerta); DLP nas exportações; mascaramento por padrão.
- **LGPD × imutabilidade (ADR-08):** direito ao esquecimento sobre dados append-only via **crypto-shredding** — cada cidadão tem chave própria; "apagar" = destruir a chave, tornando o payload irrecuperável sem quebrar a cadeia de hash nem a auditoria estrutural.

---

## 7. Auditoria imutável e verificável

- **Append-only** + **hash chain:** `hash = H(prevHash || conteúdo)`. Qualquer adulteração quebra a cadeia.
- **Ancoragem periódica:** o hash-raiz de cada janela é assinado e gravado em **storage WORM** (e opcionalmente publicado num ledger externo/notarização) — não-repúdio.
- **Segregação de acesso:** nenhum usuário comum remove/edita; até administradores não têm DELETE (permissão negada no nível do banco).
- **Conteúdo mínimo:** usuário, finalidade, operação, objeto, unidade/UF, IP, timestamp, resultado, traceId.
- **Verificador independente:** job que revalida a cadeia e alerta divergências.

---

## 8. Escalabilidade horizontal (100M+ cidadãos)

- **Kubernetes** multi-AZ/multi-região; **HPA** por CPU/latência/lag de fila; stateless nos serviços de API.
- **Banco:** Postgres HA (Patroni) por célula, **read replicas** para consultas, **particionamento** (UF + hash de cidadão + tempo), connection pooling (PgBouncer). CQRS tira a carga de leitura longitudinal do OLTP.
- **Kafka:** partições por `cidadaoId`; RF=3; retenção + tiered storage.
- **Cache:** Redis para sessão, tokens, read-through do MPI e projeções quentes.
- **CDN** para frontend; **API Gateway** escala independente.
- **Cell-based:** escala = adicionar células; blast radius contido a uma região.
- **Teste de carga:** perfis realistas (campanha nacional de vacinação = pico de `EstoqueMovimentado`/`VacinaAplicada`), metas de p99 e throughput por serviço.

---

## 9. APIs principais

- **REST** para CRUD (`/api/v1/...`), **Event API** (Kafka) para integração interna, **FHIR R4** para interoperabilidade externa (labs, RNDS).
- **API Gateway** central: authN/Z, rate limit, roteamento, injeção de `traceId`, versionamento (`/v1`, `/v2`).
- **Resposta padronizada:**
```json
// sucesso
{ "success": true, "data": {}, "traceId": "..." }
// erro
{ "success": false, "error": { "code": "", "message": "" }, "traceId": "..." }
```
Endpoints-chave: `/cidadaos` (MPI, resolução de identidade), `/pacientes`, `/atendimentos`, `/prontuarios/{cidadaoId}` (read model longitudinal), `/prescricoes`, `/exames`, `/vacinacao`, `/internacoes`, `/estoque`, `/auditoria`. OpenAPI obrigatório + testes de contrato.

---

## 10. Qualidade e observabilidade

- **Testes:** unitários (regras de domínio), integração (DB+services via Testcontainers), **contrato** (Pact) entre serviços, **carga** (k6/Gatling). Cobertura-alvo 80%, priorizando regras clínicas, identidade, autorização e auditoria.
- **Observabilidade:** logs estruturados JSON com `traceId`; **OpenTelemetry** ponta a ponta; métricas Prometheus; dashboards Grafana; **alerta clínico = severidade crítica** (ex.: falha ao registrar evento clínico ou quebra de hash-chain aciona on-call).
- **Confiabilidade:** SLOs por serviço; RTO/RPO definidos (RPO→0 para dado clínico via replicação síncrona + outbox); DR multi-região; game days.

---

## Ambiguidades técnicas (problema → impacto nacional → solução formal)

**AMB-1 — Resolução de identidade do cidadão (CPF ausente/ inválido; múltiplos CNS; homônimos).**
- *Impacto:* duplicação de prontuário entre estados (viola regra nº 1) ou fusão indevida de dois cidadãos (gravíssimo — mistura histórico clínico).
- *Solução:* MPI com *matching* determinístico (CPF/CNS) + probabilístico (nome, nascimento, mãe) com limiares; casos ambíguos vão para fila de **reconciliação humana**; toda fusão/split é evento auditável e reversível (`merge_history`).

**AMB-2 — Segregação por UF × prontuário único nacional.**
- *Impacto:* tensão entre soberania de dados regional e continuidade do cuidado nacional.
- *Solução:* identidade global (MPI) + dado clínico regional + agregação nacional por read model sob **finalidade/consentimento**; acesso cross-UF sempre logado com finalidade.

**AMB-3 — Consistência do estoque em rede instável.**
- *Impacto:* saldo negativo ou dispensação sem baixa em UBS offline.
- *Solução:* estoque **forte localmente** (transação na unidade), agregado nacional **eventual**; reservas otimistas offline com conciliação na sincronização e alerta de divergência.

**AMB-4 — Esquecimento (LGPD) × imutabilidade clínica × obrigação de retenção.**
- *Impacto:* conflito legal — dado de saúde tem retenção obrigatória, mas há direito de eliminação de dados pessoais não-clínicos.
- *Solução:* **crypto-shredding** para dados elegíveis; retenção legal preservada para o registro clínico; decisão de escopo de apagamento é *policy* configurável com parecer jurídico — **não** deve ser assumida pelo sistema sem definição do DPO/base legal.

**AMB-5 — Ordenação de eventos entre regiões/offline.**
- *Impacto:* timeline clínica inconsistente (evento chega fora de ordem).
- *Solução:* **HLC** por evento + ordenação por `streamId`; read model tolera reordenação (idempotente); `occurredAt` (clínico) separado de `recordedAt` (sistêmico).

**AMB-6 — Definição de célula (por UF, macro-região ou por carga).**
- *Impacto:* granularidade errada = desperdício (célula por UF pequena) ou blast radius grande demais.
- *Solução:* célula por **macro-região** inicialmente, com política de split quando a célula excede limites de carga/latência definidos — **decisão que exige dados operacionais reais**, não deve ser fixada às cegas.
