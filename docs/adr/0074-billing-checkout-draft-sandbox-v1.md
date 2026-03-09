# ADR 0074: Billing Checkout Draft Sandbox V1

- Status: accepted
- Date: 2026-03-06

## Context

`billingV1` já possuía readiness e configurações internas de provider, mas ainda faltava uma camada persistida para testar copy, pricing e composição do checkout sem abrir cobrança real. Sem isso, a discussão de conversão e UX de checkout ficaria solta em mock ou dependeria cedo demais de integrações reais com Stripe/Mercado Pago.

## Decision

Adicionar uma superfície interna de draft sandbox para checkout:

- `GET/PATCH /api/v1/billing/checkout-draft`
- persistência em `public.billing_checkout_drafts`
- preview interno na UI de `/billing`
- escrita bloqueada em produção por padrão, seguindo a mesma regra do restante de `billingV1`

Esta fase não cria checkout real, não gera sessão de pagamento e não grava assinatura.

## Consequences

Positive:

- Permite validar UX, copy, preços e framing comercial antes de abrir superfícies públicas.
- Mantém todas as mudanças aditivas e org-scoped.
- Reaproveita o gating já existente de preview/development para writes internos.

Tradeoffs:

- Ainda não existe sessão real de checkout nem reconciliação com provedores.
- O draft pode divergir do checkout real futuro, então a próxima fase deve criar um adapter explícito de transformação entre draft e runtime.
