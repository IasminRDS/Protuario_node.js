# Segurança — SNPE

Postura de segurança do Sistema Nacional de Prontuário Eletrônico e
auto-avaliação. **Não substitui** pentest e certificação por terceiro
independente — pré-requisitos formais para operação nacional.

## Divulgação responsável
Encontrou uma vulnerabilidade? **Não** abra issue pública. Reporte a
`seguranca@snpe.gov.br` (canal a definir). Faremos triagem em até 5 dias úteis.

## Controles implementados

### Autenticação e sessão
- Senhas com **Argon2** (nunca texto puro); bloqueio após N tentativas (RN-003).
- **JWT** access (15m) + refresh (7d) rotacionado; refresh armazenado como hash.
- **MFA TOTP** (RFC 6238) com step-up obrigatório em export/backup para perfis
  administrativos (fail-closed).
- **gov.br OIDC** com selos de confiabilidade; tokens da app nunca na URL.
- Segredos JWT ≥ 32 chars em produção (validado no boot; app não sobe sem).

### Autorização
- **RBAC** granular (recurso:ação) + guards; a autoridade é o backend.
- **RLS no PostgreSQL** (tenant por `hospital_id`): isolamento no banco, resiste
  a query raw e bug de app-layer. SuperAdmin cross-tenant é **leitura** apenas,
  com WITH CHECK estrito na escrita e auditoria obrigatória.

### Auditoria e não-repúdio
- Auditoria **append-only (WORM)** com triggers que bloqueiam UPDATE/DELETE.
- **Hash-chain** criptográfica (SHA-256 encadeado) — adulteração detectável em
  `GET /auditoria/verify`.
- Acesso a PHI e ações de SuperAdmin sempre auditados.

### Transporte e cabeçalhos
- **Helmet** (headers de segurança). CORS restrito por allowlist.
- **Rate limiting** global (@nestjs/throttler) + limites específicos e mais
  restritos em export/backup.
- Assinatura digital de documentos (SHA-256/RSA; ICP-Brasil em produção).

### Dados
- Validação estrita de entrada (`ValidationPipe` whitelist + forbidNonWhitelisted).
- Sem PII em query string; verificação pública de documentos não expõe PHI.
- LGPD: base legal mapeada (ver `BASE-LEGAL-LGPD.md`), consentimento versionado,
  retenção 20 anos, break-the-glass justificado.

## Checklist de hardening (auto-avaliado)

| Item | Estado |
|---|---|
| Segredos fora do código (env validado) | ✅ |
| Senhas com hash forte (Argon2) | ✅ |
| MFA para operações sensíveis | ✅ |
| RBAC + RLS (defesa em profundidade) | ✅ |
| Auditoria imutável + verificável | ✅ |
| Rate limiting / anti-brute-force | ✅ |
| Headers de segurança (Helmet) | ✅ |
| Validação/sanitização de entrada | ✅ |
| CORS restrito | ✅ |
| Resiliência (falha de dependência não derruba a API) | ✅ |
| `npm audit` sem vulnerabilidades altas/críticas | ⚙️ rodar no CI |
| Secrets manager (Vault/KMS) em produção | ⬜ pendente prod |
| mTLS entre serviços (Zero Trust) | ⬜ pendente prod |
| **Pentest por terceiro independente** | ⬜ **processo externo** |
| **Certificação (ISO 27001 / gov)** | ⬜ **processo externo** |
| WAF / proteção de borda | ⬜ pendente prod |

## Rotina de verificação
```bash
# Vulnerabilidades de dependência
npm audit --omit=dev
# Integridade da cadeia de auditoria
curl -H "Authorization: Bearer <admin>" http://localhost:3000/api/v1/auditoria/verify
```

## O que falta para "produção nacional"
Pentest + certificação por terceiro, secrets manager, mTLS/Zero-Trust na malha,
WAF, e homologação de segurança junto aos órgãos (ver `HOMOLOGACAO.md`).
