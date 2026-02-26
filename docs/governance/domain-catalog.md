# Domain Catalog

## obras (Execution)
- Scope: obra lifecycle, etapas, checklists, diário, execution-summary.
- Critical APIs: `/api/v1/obras/*`.
- Roles: admin/manager/user with execution permissions matrix.

## comercial
- Scope: leads pipeline, SLA, next-action, visitas.
- Critical APIs: `/api/v1/leads/*`, `/api/v1/visitas/*`.
- Roles: `can_manage_leads`.

## financeiro
- Scope: transações, compras, orçamentos, desvios.
- Critical APIs: `/api/v1/transacoes/*`, `/api/v1/compras/*`, `/api/v1/orcamentos/*`.
- Roles: `can_manage_finance`.

## projetos
- Scope: project planning and conversion to obra.
- Critical APIs: `/api/v1/projetos/*`.
- Roles: `can_manage_projects`.

## organizacao/config
- Scope: org profile, members, role changes.
- Critical APIs: `/api/v1/config/*`, `/api/v1/equipe/*`, `/api/v1/perfil/*`.
- Roles: `can_manage_team` + org role checks.

## portal (planned)
- Scope: external client view, approvals, timeline access.
- Critical APIs: `/api/v1/portal/*`.
- Security: token-scoped session + org/obra constraints.
