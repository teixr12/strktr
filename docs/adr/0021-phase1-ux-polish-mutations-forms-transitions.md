# ADR-0021: Phase 1 UX Polish — Optimistic Mutations, Form Validation, Page Transitions

## Status
Accepted

## Context
Phase 0 (ADR-0020) established the UX foundation (SWR cache, toast, skeletons, Cmd+K, confirm dialogs). Phase 1 builds on this foundation to deliver optimistic CRUD mutations, form-level validation, mobile-first modals, page transitions, and touch-friendly interaction patterns across all 11 form-bearing components.

Key gaps addressed:
- All forms used raw `useState` + manual validation — no error messaging, no field-level feedback
- CRUD operations had no optimistic UI — users saw stale data until full re-fetch
- Modals were `fixed inset-0` divs — not mobile-friendly, no bottom-sheet on small screens
- Page navigation had no visual transition — abrupt content swap
- Hover-only action buttons were invisible on touch devices

## Decision

### 1.1 — useMutation Hook
Generic optimistic mutation hook (`src/hooks/use-mutation.ts`):
- Snapshots current state via `useRef` for auto-rollback on error
- Handles toast (success/error), analytics tracking, and `onSettled` callback
- Works with any `useState` array or SWR cache

### 1.2 — useCrudMutations Factory
Factory hook (`src/hooks/use-crud-mutations.ts`) pre-configuring create/update/delete:
- Accepts entity path, display name, state setter, analytics source
- Returns `{ createMutation, updateMutation, deleteMutation }` with `mutate()` and `isMutating`

### 1.3 — React Hook Form + Zod Integration
All 11 form-bearing components migrated to `react-hook-form` + `@hookform/resolvers` + `zod`:
- Form-level schemas separate from API schemas when types differ (e.g., string `valor_potencial` for form input)
- `zodResolver(schema) as never` workaround for Zod v4 compatibility
- Reusable `FormField`, `FormInput`, `FormTextarea`, `FormSelect` components with error-state styling and `role="alert"`

### 1.4 — ModalSheet Component
Mobile-first bottom-sheet modal (`src/components/ui/modal-sheet.tsx`):
- `items-end md:items-center` — slides from bottom on mobile, centers on desktop
- Sticky header, Escape key, backdrop click-to-close
- Width variants: `sm`, `md`, `lg`

### 1.5 — PageTransition
CSS fade-in animation on route changes (`src/components/ui/page-transition.tsx`):
- Client component using `key={pathname}` for re-mount on navigation
- Applied in `(app)/layout.tsx` wrapping `{children}`

### 1.6 — Touch-Visible Pattern
All hover-only action buttons made visible on touch devices:
- Pattern: `md:opacity-0 md:group-hover:opacity-100` — always visible on mobile, hover-reveal on desktop
- Applied to: leads kanban drag handles, calendar event actions, KB article actions, obra checklist actions, etapa delete buttons

### 1.7 — Kanban Scroll Hint
CSS `mask-image` gradient on horizontal kanban containers for mobile scroll affordance:
- `.kanban-scroll-hint` class with fade-out gradient on right edge

## Components Migrated
1. `equipe/equipe-content.tsx` — invite form
2. `knowledgebase/kb-content.tsx` — article form
3. `financeiro/financeiro-content.tsx` — transaction form
4. `compras/compras-content.tsx` — purchase form
5. `projetos/projetos-content.tsx` — project form
6. `calendario/calendario-content.tsx` — visit form
7. `leads/leads-content.tsx` — lead form (most complex: Kanban + pagination + SLA)
8. `orcamentos/orcamentos-content.tsx` — budget form (nested items kept as separate state)
9. `perfil/perfil-content.tsx` — profile + password forms (dual useForm)
10. `obras/obra-detail-content.tsx` — etapa form
11. `configuracoes/org-settings.tsx` — invite + org creation forms

## Consequences
- All forms now show field-level validation errors with accessible `role="alert"` attributes
- CRUD operations are optimistic with automatic rollback on failure
- Modals are mobile-friendly with bottom-sheet UX on small screens
- Page transitions provide visual continuity during navigation
- Touch device users can access all action buttons without hover
- Dependencies added: `react-hook-form` (7.71.2), `@hookform/resolvers` (5.2.2) — both tree-shakeable
