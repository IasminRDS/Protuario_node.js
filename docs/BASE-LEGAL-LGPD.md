# Base legal (LGPD) e retenção do prontuário — SNPE

> Mapa das operações de tratamento de dados pessoais e sensíveis do SNPE às
> respectivas bases legais da Lei 13.709/2018 (LGPD) e às regras de retenção do
> prontuário. **Documento técnico** — não substitui parecer jurídico formal, que
> é pré-requisito para operação nacional real.

## 1. Natureza dos dados
Dados **pessoais sensíveis** (LGPD art. 5º, II): dados de saúde. O tratamento de
dado sensível exige base legal específica do **art. 11** da LGPD.

## 2. Bases legais por operação

| Operação | Base legal (LGPD) | Observações |
|---|---|---|
| Registro/consulta de prontuário (assistência) | Art. 11, II, "a" — tutela da saúde, por profissionais de saúde | Finalidade assistencial; acesso auditado |
| Notificação compulsória (SINAN) | Art. 11, II, "e" + art. 7º, III — obrigação legal / política pública | Portaria de Consolidação GM/MS nº 4/2017 |
| Vigilância epidemiológica / painel | Art. 11, II, "e" — políticas públicas de saúde | Agregados; sem exposição individual desnecessária |
| Regulação de vagas (SISREG) | Art. 11, II, "a" — tutela da saúde | Compartilhamento entre unidades do SUS |
| Interoperabilidade RNDS | Art. 11, II, "e" — política pública (RNDS/DATASUS) | Envio a órgão público de saúde |
| Exportação de dados (gestão) | Art. 11, §4º — comunicação/uso compartilhado, vedado a terceiros com fim econômico | MFA obrigatório + auditoria |
| Login gov.br / identificação | Art. 7º, V — execução de política pública; art. 11, II, "e" | Selo de confiabilidade |
| Auditoria de acesso | Art. 11, II, "a"/"e" + dever de segurança (art. 46-48) | Trilha imutável (WORM + hash-chain) |
| Break-the-glass (emergência) | Art. 11, II, "c" — proteção da vida / incolumidade física | Justificativa obrigatória, registrada |
| Consentimento (quando aplicável) | Art. 11, I — consentimento específico e destacado | Versionado (`ConsentimentoLgpd`) |

## 3. Direitos do titular (art. 18) — como o SNPE atende
- **Acesso / confirmação**: Portal do Cidadão (histórico, cartão de vacinas).
- **Transparência de acesso**: "quem acessou meu prontuário" (`/prontuarios/:id/acessos`).
- **Segurança e não-repúdio**: RLS por tenant, auditoria WORM com hash-chain
  verificável (`/auditoria/verify`), MFA para operações sensíveis.
- **Portabilidade / interoperabilidade**: exportação FHIR R4 e envio RNDS.

## 4. Retenção do prontuário
- **Regra**: CFM Res. 1.821/2007 — guarda **mínima de 20 anos** a contar do
  último registro do paciente. O prontuário **digital** pode ser mantido de
  forma **permanente** (a eliminação após 20 anos é facultativa e aplicável
  sobretudo ao suporte físico).
- **Implementação**: `RETENTION_YEARS` (default 20). O endpoint
  `GET /lgpd/retencao` reporta o corte temporal e quantos registros já
  soft-deletados estão **elegíveis a expurgo**.
- **Expurgo NÃO é automático**: exige decisão institucional/jurídica registrada.
  Dado clínico nunca é apagado por rotina — apenas soft-delete (LGPD art. 16
  admite conservação para cumprimento de obrigação legal e uso exclusivo do
  controlador, anonimizado quando possível).

## 5. Segurança (art. 46-48)
- Isolamento por estabelecimento (RLS no PostgreSQL).
- Criptografia de assinatura de documentos (SHA-256/RSA; ICP-Brasil em produção).
- Auditoria imutável com cadeia de hash (não-repúdio).
- Notificação de incidente (art. 48): processo institucional a definir.

## 6. Pendências para operação nacional real
- Parecer jurídico formal validando este mapa.
- DPO (Encarregado) designado (art. 41).
- RIPD — Relatório de Impacto à Proteção de Dados (art. 38).
- Contratos de operador/co-controlador (União/estados/municípios).
