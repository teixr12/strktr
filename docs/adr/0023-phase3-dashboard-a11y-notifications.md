# ADR-0023 — Phase 3: Dashboard Enrichment, Accessibility, Empty States & Notification Center

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-03-02 |
| Builds on | ADR-0020 (Phase 0), ADR-0021 (Phase 1), ADR-0022 (Phase 2) |

## Context

Phases 0–2 delivered caching, skeletons, error boundaries, optimistic mutations, and API consistency. Phase 3 addresses four remaining gaps: keyboard accessibility, dashboard trend visualization, teaching empty states, and a full notification center page.

## Decision

### 3A — Accessibility Quick Wins
- Global `*:focus-visible` ring using `--color-sand-500` for keyboard navigation visibility.
- Skip-to-content link (`<a href="#main-content">`) as first element in `AppShell`.
- Semantic landmarks: `<nav aria-label="Menu principal">`, `<header role="banner">`, `<main id="main-content">`.
- Aria attributes on interactive elements: `aria-label` on toggles, `aria-expanded`/`aria-haspopup` on notification bell, `aria-current="page"` on active nav links.

### 3B — Dashboard Enrichment
- **Sparklines**: Pure SVG polyline (64x24 viewBox) added to `KpiCard` via optional `sparkline: number[]` prop. Zero external dependencies.
- **Trends API**: Extended `/api/v1/dashboard/summary` with `trends` (obras/leads monthly counts), reusing existing `financeChart` data for receitas/despesas.
- **Date range filter**: Client-side `range` state (`30d | 90d | 6m | 12m | ytd`) passed as query param to summary API. Server computes `startDate` and `bucketCount` dynamically.
- **Pipeline funnel**: Horizontal bar visualization (`PipelineFunnel` component) replacing the flat list. Width proportional to count, colored by pipeline stage, shows conversion rates between adjacent stages.
- **Onboarding checklist**: 4-step progress tracker (obra, lead, equipe, transacao) auto-hides when all complete. Replaces the previous two-card onboarding section.

### 3C — Empty States
- All 8 content modules now render `EmptyStateAction` with module-specific teaching copy and CTA when data is empty. Uses the existing enterprise component.

### 3D — Notification Center
- New route `/notificacoes` with server-side fetch (limit 100), filter tabs (Todas / Nao lidas / Urgentes), date-grouped list, per-item and bulk mark-as-read.
- Notification bell dropdown now includes "Ver todas as notificacoes" link.
- Sidebar and header updated with Notificacoes nav item.
- API enhanced: max limit raised to 200, added `tipo` query param filter.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|-------------|
| Chart.js / Recharts for sparklines | Overkill for 7-point trend lines; SVG polyline is 0 KB added bundle |
| Server-side date range via searchParams | Would cause full-page SSR refresh; client-side re-fetch with SWR pattern is snappier |
| D3-based funnel chart | Too heavy; pure CSS width proportions achieve the same visual |
| Separate notification service / WebSocket | Over-engineering for current scale; polling + SSR fetch sufficient |

## Consequences

- Keyboard-only users can now navigate the entire app with visible focus indicators.
- Dashboard shows trend direction at a glance via sparklines.
- New users see actionable guidance in every empty module.
- Full notification history is browsable and filterable beyond the 20-item bell dropdown.
- No new runtime dependencies added.

## Files Changed

**New (6)**: `pipeline-funnel.tsx`, `onboarding-checklist.tsx`, `notificacoes/page.tsx`, `notificacoes-content.tsx`, `notificacoes/loading.tsx`, `notificacoes/error.tsx`

**Modified (~18)**: `globals.css`, `app-shell.tsx`, `sidebar.tsx`, `header.tsx`, `notification-bell.tsx`, `kpi-card.tsx`, `dashboard/summary/route.ts`, `dashboard-content.tsx`, `notificacoes/route.ts`, 8 content components (leads, obras, financeiro, compras, orcamentos, equipe, calendario, knowledgebase)
