# Homologação e integrações oficiais — SNPE

O que separa o SNPE de um sistema **em produção nacional** são processos
**externos e formais** de credenciamento. O código já está **plugável**: cada
integração roda em modo simulado por padrão e passa a real ao configurar
credenciais/endpoints. Este documento descreve o processo e a configuração.

---

## 1. Login gov.br (OIDC)

**Estado**: fluxo OIDC Authorization Code completo; IdP simulado embutido.

**Para produção**:
1. Solicitar credenciamento do serviço na **Área do Desenvolvedor gov.br**
   (https://acesso.gov.br → integração), definindo `redirect_uri`.
2. Receber `client_id` e `client_secret` (guardar em secrets manager).
3. Configurar:
   ```
   GOVBR_SIMULATOR=false
   GOVBR_CLIENT_ID=<client_id>
   GOVBR_CLIENT_SECRET=<client_secret>
   GOVBR_AUTHORIZE_URL=https://sso.acesso.gov.br/authorize
   GOVBR_TOKEN_URL=https://sso.acesso.gov.br/token
   GOVBR_USERINFO_URL=https://sso.acesso.gov.br/userinfo
   GOVBR_REDIRECT_URI=https://<host>/api/v1/auth/govbr/callback
   ```
4. Ponto de código: `GovbrService.resolveCode()` — troca o `code` no token
   endpoint e lê o `userinfo` (sub = CPF → `Usuario.cpf`). Selo vem de
   `amr`/`confiabilidades`.

## 2. Assinatura ICP-Brasil

**Estado**: assinatura SHA-256/RSA real; par efêmero em dev.

**Para produção**:
1. Adquirir **certificado ICP-Brasil** do estabelecimento (e-CNPJ A1) ou do
   profissional (e-CPF), emitido por AC credenciada.
2. Exportar a chave privada em **PEM** e configurar:
   ```
   DOC_SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   ```
3. `SigningService` passa a assinar com o certificado real; o QR aponta para a
   verificação pública. Para validade jurídica plena, aderir ao padrão de
   assinatura **CAdES/PAdES** e validar em https://validar.iti.gov.br.

## 3. RNDS (Rede Nacional de Dados em Saúde)

**Estado**: bundles FHIR R4 reais (RAC/RIA/resultado); transporte simulado.

**Para produção**:
1. Solicitar credenciamento na **RNDS/DATASUS**, obter o **certificado de
   estabelecimento** (mTLS) e o endpoint da UF.
2. Configurar:
   ```
   RNDS_ENABLED=true
   RNDS_ENDPOINT=https://ehr-services.saude.gov.br/api/fhir/r4
   RNDS_CLIENT_CERT=/secrets/rnds-cert.pem
   RNDS_CLIENT_KEY=/secrets/rnds-key.pem
   ```
3. Ponto de código: `RndsService.despachar()` — POST mTLS do bundle no endpoint
   e leitura do protocolo de recebimento.

## 4. Cadastros oficiais (CNES/CBO/SIGTAP/CID-10/RENAME)

**Estado**: subconjuntos curados para autocomplete.

**Para produção**: importar as tabelas oficiais completas do DATASUS
(CID-10 ~14 mil, SIGTAP mensal, CNES, CBO, RENAME) via job de carga. Os
catálogos in-memory viram cache; a fonte passa a ser a tabela importada.

## 5. Infraestrutura de escala

**Implantado (compose de referência)**: Kafka (KRaft), Prometheus, Grafana,
PostgreSQL, Redis.

**Para produção nacional** (ver `ARQUITETURA-SNPE.md`): células por macro-região
(UF), PostgreSQL HA (Patroni) com réplica síncrona, Kubernetes (HPA, multi-AZ),
OTel→Tempo/Loki, object storage WORM, e API Gateway (Kong) com mTLS/WAF.

## 6. Segurança e conformidade (processos externos)
- **Pentest** por terceiro independente + correção + reteste.
- **Certificação** (ISO 27001, e requisitos gov de segurança).
- **Parecer jurídico** LGPD + DPO + RIPD (ver `BASE-LEGAL-LGPD.md`).
- **Validação clínica** por CFM/COFEN e profissionais de saúde.

## Resumo de flags (dev → produção)

| Integração | Flag dev | Produção |
|---|---|---|
| gov.br | `GOVBR_SIMULATOR=true` | `false` + credenciais |
| ICP-Brasil | (par efêmero) | `DOC_SIGNING_PRIVATE_KEY` |
| RNDS | (mock) | `RNDS_ENABLED=true` + cert mTLS |
| Kafka | `KAFKA_ENABLED=true` (broker local) | cluster gerenciado |
| RLS | `RLS_ENABLED=true` | idem + role `prontuario_app` |
