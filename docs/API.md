# SNPE — Referência de API

Referência dos endpoints REST do backend. Gerada a partir dos controllers
(`backend/src/**/*.controller.ts`).

## Convenções

- **Base URL**: `/api/v1` (versionamento por URI). Exceção: `/metrics` é
  *version-neutral* (`/metrics`).
- **Autenticação**: `Authorization: Bearer <access_token>` em todas as rotas,
  exceto as marcadas **🔓 Público**.
- **Autorização**: cada rota exige a **permissão** indicada (RBAC —
  `@RequirePermissions`). Permissão declarada na classe vale para todas as rotas
  do controller salvo override. Ver perfis em [VISAO-GERAL.md §7](VISAO-GERAL.md#7-rbac--perfis-e-permissões).
- **Isolamento**: rotas clínicas são automaticamente escopadas pelo `hospitalId`
  do usuário (tenant). SuperAdmin lê cross-tenant (auditado).
- **Envelope**: respostas de dados usam `{ data, message }`; listas paginadas
  incluem `meta` (`total`, `page`, `pageSize`). `BigInt` é serializado como string.

---

## Identidade & acesso

### `auth` — autenticação
| Método | Rota | Permissão |
|---|---|---|
| POST | `/auth/login` | 🔓 Público |
| POST | `/auth/refresh` | 🔓 Público |
| POST | `/auth/logout` | autenticado |
| POST | `/auth/mfa/verify` | 🔓 Público (2º fator do login) |
| GET | `/auth/mfa/status` | autenticado |
| POST | `/auth/mfa/setup` | autenticado |
| POST | `/auth/mfa/enable` | autenticado |
| POST | `/auth/mfa/disable` | autenticado |
| POST | `/auth/change-password` | autenticado |

### `auth/govbr` — login federado gov.br (OIDC) · 🔓 Público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/auth/govbr/status` | flags (habilitado/simulador) |
| GET | `/auth/govbr/login` | inicia o Authorization Code |
| GET | `/auth/govbr/simulador` | IdP simulado (dev/homolog) |
| GET | `/auth/govbr/callback` | recebe o `code` |
| POST | `/auth/govbr/session` | troca código de sessão por tokens |

### `usuarios` · classe: `admin:full`
| Método | Rota |
|---|---|
| GET | `/usuarios` · GET `/usuarios/:id` |
| POST | `/usuarios` · PATCH `/usuarios/:id` · DELETE `/usuarios/:id` |

### `perfis`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/perfis` | autenticado |
| POST | `/perfis` | `admin:full` |

### `hospitals` · classe: `hospital:manage`
| Método | Rota |
|---|---|
| GET | `/hospitals` · `/hospitals/:id` |
| POST | `/hospitals` · PATCH `/hospitals/:id` · DELETE `/hospitals/:id` |

---

## Paciente & MPI

### `pacientes`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/pacientes` (lista, filtros nome/cpf) | `patient:read` |
| GET | `/pacientes/:id` | `patient:read` |
| POST | `/pacientes` | `patient:create` |
| PUT/PATCH | `/pacientes/:id` | `patient:create` |
| DELETE | `/pacientes/:id` | `admin:full` |

### `mpi/cidadaos` — índice mestre (identidade nacional)
| Método | Rota | Permissão |
|---|---|---|
| POST | `/mpi/cidadaos` | `patient:create` |
| GET | `/mpi/cidadaos/resolve` | `patient:read` |

---

## Fluxo clínico

### `triage`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/triage` | `triage:write` |
| GET | `/triage/paciente/:id` | `clinical:read` |

### `pronto-socorro`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/pronto-socorro` | `emergency:write` |
| GET | `/pronto-socorro/fila` · `/pronto-socorro/:id` | `clinical:read` |
| POST | `/pronto-socorro/:id/chamar` · `/:id/finalizar` | `emergency:write` |

### `encounters` (atendimentos)
| Método | Rota | Permissão |
|---|---|---|
| POST | `/encounters` | `encounter:write` |
| GET | `/encounters` · `/encounters/:id` | `clinical:read` |
| PATCH | `/encounters/:id/{pause,resume,observe,discharge,cancel}` | `encounter:write` |
| POST | `/encounters/:id/notes` | `encounter:write` |

### `internacao`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/internacao/setores` · `/internacao/leitos` · `/internacao` | `internment:write` |
| GET | `/internacao/setores` · `/leitos` · `/internacao` · `/:id` | `clinical:read` |
| POST | `/internacao/:id/evolucao` · `/:id/alta` | `internment:write` |

### `exames`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/exames/tipos` · `/exames` | `exam:write` |
| GET | `/exames/tipos` · `/exames` · `/exames/paciente/:id` | `clinical:read` |
| PATCH | `/exames/:id/coleta` · `/:id/resultado` | `exam:write` |

### `cirurgia`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/cirurgia/salas` · `/cirurgia` | `surgery:write` |
| GET | `/cirurgia/salas` · `/cirurgia` | `clinical:read` |
| PATCH | `/cirurgia/:id/{iniciar,concluir,cancelar}` | `surgery:write` |

### `prescricao-hospitalar`
| Método | Rota | Permissão |
|---|---|---|
| POST | `/prescricao-hospitalar` · `/:id/suspender` | `prescription:write` |
| GET | `/prescricao-hospitalar/paciente/:id` · `/internacao/:id` | `clinical:read` |
| POST | `/prescricao-hospitalar/item/:itemId/administrar` | `med-admin:write` |

### `prescriptions` (ambulatorial)
| Método | Rota | Permissão |
|---|---|---|
| POST | `/prescriptions` | `prescription:write` |
| GET | `/prescriptions/atendimento/:id` | `clinical:read` |

### `prontuarios`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/prontuarios/:pacienteId` (timeline) | `clinical:read` |
| GET | `/prontuarios/:pacienteId/sumario` | `clinical:read` |
| GET | `/prontuarios/:pacienteId/acessos` (transparência LGPD) | `clinical:read` |

---

## Saúde pública

### `vigilancia` (SINAN)
| Método | Rota | Permissão |
|---|---|---|
| GET | `/vigilancia/notificacoes` · `/vigilancia/agravos` | `surveillance:read` |
| POST | `/vigilancia/notificacoes` | `surveillance:write` |
| PATCH | `/vigilancia/notificacoes/:id` | `surveillance:write` |

### `regulacao`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/regulacao/fila` | `regulation:read` |
| POST | `/regulacao` | `regulation:write` |
| PATCH | `/regulacao/:id` | `regulation:decide` |

### `epidemiologia` · todas: `reports:read`
`GET /epidemiologia/{resumo, notificacoes-por-agravo, notificacoes-por-municipio,
ocupacao-leitos, fila-regulacao, triagem-manchester}`

---

## Documentos & interoperabilidade

### `pdf` · classe: `clinical:read`
`GET /pdf/paciente/:id/prontuario` · `/pdf/prescricao/:id` · `/pdf/alta/:id`

### `documentos` · 🔓 Público (verificação de assinatura)
`GET /documentos/verificar/:id` · `/documentos/chave-publica`

### `rnds` (FHIR R4)
| Método | Rota | Permissão |
|---|---|---|
| GET | `/rnds/envios` | `reports:read` |
| GET | `/rnds/preview/:tipo/:entityId` | `clinical:read` |
| POST | `/rnds/enviar` · `/rnds/envios/:id/reenviar` | `clinical:read` |

### `fhir` · classe: `clinical:read`
`GET /fhir/Patient/:id` · `/fhir/Encounter/:id` · `/fhir/Encounter/:id/MedicationRequest`

### `terminologia` (catálogos DATASUS) · autenticado
`GET /terminologia/{cid10, medicamentos, cbo, sigtap, cnes}`

---

## Dados & conformidade

### `export`
`GET /export/pacientes` — export tenant-safe (throttled; MFA opcional via `MFA_ENFORCE_EXPORT`).

### `csv`
`POST /csv/pacientes/import` — `patient:create`.

### `backup`
`POST /backup` — dump via `pg_dump` (conexão de manutenção / role dona).

### `reports` · classe: `reports:read`
`GET /reports/{atendimentos-por-dia, ocupacao-leitos, tempo-medio, exames}` ·
`POST /reports/export/audit`

### `auditoria` · `audit:read`
`GET /auditoria` (lista) · `GET /auditoria/verify` (integridade hash-chain) ·
`POST /auditoria/selar`

### `lgpd`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/lgpd/retencao` | `audit:read` |
| GET | `/lgpd/consentimento/status` | autenticado |
| POST | `/lgpd/consentimento` | autenticado |
| POST | `/lgpd/break-the-glass/:pacienteId` | autenticado (auditado) |

### `locks` — lock distribuído
`POST /locks/{acquire,heartbeat,release}` · `GET /locks/:resource/:resourceId`

---

## Infraestrutura & operação

### `internal/consistency` · classe: `admin:full`
| Método | Rota | Permissão |
|---|---|---|
| GET | `/internal/consistency/health` · `/report` | `admin:full` |
| GET | `/internal/consistency/metrics` | 🔓 Público (scrape sem JWT) |

### `outbox` · classe: `admin:full`
`GET /outbox/stats` · `/outbox/dead-letter`

### `metrics` (Prometheus) · 🔓 Público · version-neutral
`GET /metrics`
