# ADR 0076: Public API Client Token Foundation V1

## Context

`publicApiV1` já possuía:

- readiness interno
- matriz de scopes
- governança de clientes com ownership, exposure e quotas

Ainda faltava uma fundação real para credenciais internas por cliente.

Sem isso, a API pública continuaria sem inventário de tokens, sem trilha mínima de revogação e sem uma transição segura para emissão futura de credenciais externas.

## Decision

Adicionar uma fundação interna de tokens por cliente com:

- tabela `public_api_client_tokens`
- segredo gerado apenas no momento da criação
- persistência apenas de `hash`, `prefix` e `last_four`
- rotas internas protegidas:
  - `GET/POST /api/v1/public-api/clients/:id/tokens`
  - `PATCH /api/v1/public-api/clients/:id/tokens/:tokenId`
- escrita bloqueada em produção por padrão

Sem autenticação third-party real e sem consumo externo nessa fase.

## Consequences

- o domínio passa a ter inventário e governança mínima de credenciais
- a camada externa continua bloqueada até enforcement real de quota, autenticação por token e compliance
- o rollout permanece seguro porque o write fica limitado a preview/staging por padrão
