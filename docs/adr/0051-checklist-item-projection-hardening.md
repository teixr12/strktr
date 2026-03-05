# ADR 0051: Checklist Item Projection Hardening

- Date: 2026-03-05
- Status: Accepted

## Context

Checklist item write endpoints still returned `select('*')`, which kept query-shape drift and violated the performance governance target for explicit projections.

The affected routes were:

- `POST /api/v1/obras/:id/checklists/:checklistId/items`
- `PATCH /api/v1/obras/:id/checklists/:checklistId/items/:itemId`
- `POST /api/v1/obras/:id/checklists/items/:itemId/toggle`

These routes also have a known mixed-schema compatibility concern around `checklist_items.data_limite`.

## Decision

Adopt explicit checklist item projection maps and remove all `select('*')` usage in these routes:

- `CHECKLIST_ITEM_SELECT`
- `CHECKLIST_ITEM_SELECT_WITH_DUE_DATE`

For mixed-schema safety:

- Write operations return `id` first.
- Row fetch is done in a second query using `CHECKLIST_ITEM_SELECT_WITH_DUE_DATE`.
- If `data_limite` is unavailable, fallback fetch uses `CHECKLIST_ITEM_SELECT` and returns `data_limite: null`.

## Consequences

- Performance governance target reaches `select-star = 0`.
- API compatibility is preserved with transition-safe due-date fallback.
- No endpoint rename/remove and no schema-destructive change.
