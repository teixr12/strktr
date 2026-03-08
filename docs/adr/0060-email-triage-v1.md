# ADR 0060 — Email Triage V1

## Context
STRKTR precisava de uma base real para classificar emails de entrada sem depender de parsing automático ou inbox provider antes da arquitetura estar pronta.

## Decision
Criar `emailTriageV1` como domínio aditivo com:
- tabela própria `email_triage_items`
- CRUD real em `/api/v1/email-ingest*`
- página `/email-triage` atrás de flag + canário por organização
- classificação operacional (`lead`, `supplier`, `client`, `operations`, `spam`, `unknown`)
- vínculo opcional com lead existente

## Consequences
- V1 entra com backend real e zero ação fake.
- Automação de ingestão por mailbox fica para fase seguinte sem quebrar o modelo.
- O rollout permanece seguro com `404-safe` fora da feature/canário.
