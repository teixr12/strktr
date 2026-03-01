# ADR-0020: Phase 0 UX Foundation Layer

## Status
Accepted

## Context
The STRKTR CRM had several UX foundation gaps:
- No client-side data caching (every navigation re-fetched all data)
- A 9-line DOM-based toast notification with no queue/stacking/dismiss
- Zero route-level loading states (blank screens during SSR)
- No command palette or keyboard shortcuts
- Browser-native `window.confirm()` for all destructive actions

## Decision
Implement Phase 0 UX Foundation as additive, zero-risk improvements:

### 0.1 — SWR Client Cache
- Install `swr` (4.2kB) and create `useApi<T>` / `useApiWithMeta<T>` hooks
- Wraps existing `apiRequest` with deduplication (5s), error retry, and caching
- Feature flag ready: `NEXT_PUBLIC_FF_SWR_CACHE`

### 0.2 — React Toast System
- Replace DOM-based toast with React context + portal provider
- Max 3 toasts, auto-dismiss (3.5s), stacking, dismiss button
- Type-specific icons (CheckCircle2, XCircle, Info, AlertTriangle)
- Backward-compatible `toast(msg, type)` API signature preserved

### 0.3 — Route-Level Skeleton Loaders
- Create `PageSkeleton` component with 5 variants (dashboard, list, grid, detail, kanban)
- Add `loading.tsx` to all 12 app routes
- Uses existing `.skeleton` CSS class for shimmer animation

### 0.4 — Command Palette (Cmd+K)
- Global search modal with keyboard navigation
- Indexes all 11 nav items + quick actions (New Lead/Obra/Orçamento)
- Feature flag: `NEXT_PUBLIC_FF_CMD_PALETTE`
- Header search button hint added

### 0.5 — Confirmation Dialogs
- Promise-based `useConfirm()` hook with `ConfirmDialog` component
- Replaced ALL `window.confirm()` calls across 11 components
- Danger variant (red) for destructive actions
- Keyboard support (Escape to cancel)

## Consequences
- Perceived performance improvement (skeletons, caching)
- Design consistency (no more browser-native dialogs)
- Foundation for Phase 1 optimistic UI (SWR mutate)
- Zero API or database changes — fully backward-compatible
