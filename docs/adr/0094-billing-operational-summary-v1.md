# ADR 0094: Billing Operational Summary V1

## Status

Accepted

## Context

`billingV1` ja tinha readiness, providers, planos, readiness de assinatura, estado operacional e timeline, mas o operador ainda precisava abrir varias secoes para entender se a org estava pronta para rollout controlado.

## Decision

Adicionar um resumo operacional read-only em `GET /api/v1/billing/operational-summary` e exibi-lo no topo de `/billing`.

O resumo:

- agrega `billing_provider_settings`, `billing_plan_catalog`, `billing_subscription_readiness`, `billing_subscription_states` e `billing_subscription_events`
- calcula `status` (`healthy`, `attention`, `blocked`)
- explicita `blockers` e `warnings`
- expõe snapshot minimo para rollout seguro:
  - providers configurados/prontos
  - plano em destaque
  - provider preferido
  - launch mode
  - KYC
  - aceite de termos
  - status da assinatura
  - ultimo evento
  - ultimo sync

## Consequences

- melhora a leitura operacional sem abrir qualquer write surface nova
- preserva o gate atual de `billingV1`
- nao altera contratos existentes de billing
- prepara o dominio para rollout sandbox/internal antes de qualquer checkout real
