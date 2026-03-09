# ADR 0088 — Billing Subscription State V1

## Context

`billingV1` ja tinha readiness, providers, draft de checkout e catalogo de planos, mas ainda misturava governanca de lancamento com estado operacional real da assinatura da organizacao.

Sem um estado separado, a equipe nao consegue registrar de forma segura:

- se a org esta `inactive`, `trialing`, `active`, `past_due`, `paused` ou `canceled`
- qual provider esta operando a assinatura
- qual plano esta realmente em uso
- datas de periodo atual, trial e ultimo sync interno

## Decision

Adicionar `billing_subscription_states` como tabela aditiva, com `GET/PATCH /api/v1/billing/subscription-state`, atras de `billingV1` + canario por org + write bloqueado em producao.

O dominio continua sandbox-only:

- sem checkout real
- sem sincronizacao third-party
- sem cobranca real
- sem segredo persistido

## Consequences

Positivas:

- separa readiness de operacao
- reduz ambiguidade antes de abrir Stripe/Mercado Pago reais
- prepara o terreno para reconciliacao e lifecycle reais sem quebrar contrato existente

Negativas:

- adiciona mais uma superficie de billing para governar
- exige rollout controlado junto com o resto do lote local

## Rollback

- manter `billingV1` desligado em producao
- se necessario, desligar o canario por org
- nenhum contrato existente foi removido
