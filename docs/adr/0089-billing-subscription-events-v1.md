# ADR 0089 — Billing Subscription Events V1

## Context

`billingV1` ja tinha readiness, estado operacional, providers e catalogo interno, mas ainda faltava uma timeline auditavel para registrar mudancas relevantes da assinatura por organizacao.

Sem isso, a equipe nao consegue reconstruir com clareza:

- quando um trial foi iniciado ou prorrogado
- quando um status foi alterado manualmente
- quando houve `payment_failed`, pausa ou cancelamento
- qual provider/contexto estava associado ao evento

## Decision

Adicionar `billing_subscription_events` como tabela aditiva e expor `GET/POST /api/v1/billing/subscription-events`.

Caracteristicas:

- append-only no modelo de uso
- atras de `billingV1` + canario por org
- escrita bloqueada em producao
- sem integracao third-party real
- sem segredos e sem cobranca real

## Consequences

Positivas:

- cria trilha operacional minima para billing
- complementa `subscription-state` sem misturar estado atual e historico
- prepara o caminho para reconciliacao futura com Stripe/Mercado Pago

Negativas:

- adiciona mais uma superficie interna de billing para governar
- o historico ainda e manual/local ao tenant ate a integracao real existir

## Rollback

- manter `billingV1` desligado em producao
- desligar o canario por org se necessario
- nenhum endpoint existente foi removido ou renomeado
