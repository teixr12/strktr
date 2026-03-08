# ADR 0077: Portal Admin V2 Project Wrapper

## Context

`portalAdminV2` já possuía:

- overview central por obra
- drilldown dedicado por obra
- governança operacional de branding, clientes, convites e sessões

Ainda faltava um ponto de entrada por `projeto`.

Como o portal opera sobre a `obra` convertida, não seria correto duplicar lógica de portal diretamente em `projetos` sem respeitar o vínculo existente.

## Decision

Adicionar um wrapper de `Portal Admin V2` por projeto com:

- `GET /api/v1/portal/admin/projects/:projectId/overview`
- página `/portal-admin/projetos/:projectId`
- uso do vínculo `projetos.obra_id` quando existir
- fallback explícito quando o projeto ainda não estiver convertido em obra

Sem criar backend paralelo de portal para projeto e sem duplicar a lógica já consolidada por obra.

## Consequences

- projetos passam a ter uma entrada segura para o portal
- quando houver `obra_id`, o painel reutiliza o overview operacional já existente
- quando não houver `obra_id`, o sistema mostra estado vazio e CTA segura, sem inventar comportamento
