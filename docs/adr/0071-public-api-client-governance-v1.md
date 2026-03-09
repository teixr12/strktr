# ADR 0071: Public API Client Governance V1

## Context

`publicApiV1` já possuía readiness, checklist e matriz de scopes planejados, mas ainda não tinha persistência real para clientes internos de API, quotas e status operacionais.

Sem essa camada, a preparação para API pública continuaria apenas documental.

## Decision

Adicionar governança interna de clientes de API com:

- tabela `public_api_clients`
- CRUD interno protegido em `/api/v1/public-api/clients`
- campos de nome, status, scopes e quota por minuto
- UI interna em `/api-publica`
- nenhum segredo, token ou API key real nesta fase

## Consequences

- o produto passa a ter uma camada administrativa real antes da emissão de credenciais
- ainda não existe autenticação externa nem acesso third-party efetivo
- a abertura pública continua bloqueada até API keys, quotas e compliance fecharem
