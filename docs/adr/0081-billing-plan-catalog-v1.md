# 0081 — Billing Plan Catalog V1

## Context

`billingV1` ja possui readiness, configuracao interna e checkout draft sandbox.
Faltava uma fonte de verdade persistida para planos e pricing interno antes de abrir checkout real ou integracao com provedores.

## Decision

Adicionar um catalogo interno de planos em `billing_plan_catalog` com:

- `slug`
- `name`
- `description`
- `status`
- `currency`
- preco mensal/anual
- `trial_days`
- `accepted_providers`
- `feature_bullets`
- `featured`
- `notes`

Expor isso via:

- `GET/POST /api/v1/billing/plans`
- `PATCH /api/v1/billing/plans/:id`

## Constraints

- continua atras de `billingV1`
- escrita continua bloqueada em producao por `BILLING_V1_WRITE_ENABLED`
- nao cria assinatura, checkout real, fatura ou webhook

## Consequences

- pricing e trial deixam de ficar presos apenas ao checkout draft
- o time consegue validar catalogo, copy e governanca em preview/staging
- general release continua bloqueado ate billing real, webhook e compliance fecharem
