# ADR 0058: Supplier Management V1

- Date: 2026-03-06
- Status: accepted

## Context

Compras já armazena um campo livre de fornecedor, mas não existe um domínio próprio para cadastro, score manual, watchlist e blacklist. Isso impede governança operacional e reutilização consistente entre compras futuras.

## Decision

Criar `supplierManagementV1` como domínio novo e aditivo:

- tabela própria `fornecedores`
- APIs novas em `/api/v1/fornecedores*`
- gate `404-safe` por flag + canário por org
- página dedicada `/fornecedores`
- CTA aditiva a partir de Compras

## Consequences

- Nenhum contrato existente em `/api/v1` foi removido ou renomeado
- o campo livre `compras.fornecedor` continua compatível
- rollout pode ocorrer por org sem expor o módulo globalmente
