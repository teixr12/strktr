# ADR 0009 - Functional Confidence Hotfixes (Avatar, Nav Counts, Leads Progress, Orcamento PDF)

- Status: Accepted
- Date: 2026-02-27
- Deciders: Product/Engineering

## Context

After Wave 2 UI rollout, users reported perceived trust gaps in production:

- Profile/avatar flow looked broken in UI even though backend already accepted `avatar_url`.
- Sidebar showed hardcoded badges, reducing confidence in data correctness.
- Leads proposal progress bar had fixed UI value (`62%`).
- Orcamentos still used client-side `window.print` instead of server-side export pattern.

The system was already live on Next.js + Supabase + Vercel with API v1 stability requirements and no tolerance for breaking changes.

## Decision

We apply additive, backwards-compatible fixes only:

1. Keep `/api/v1/perfil` contract and expose `avatar_url` editing in profile UI.
2. Add `GET /api/v1/dashboard/nav-counts` (org-scoped) and remove hardcoded sidebar chips.
3. Replace hardcoded leads proposal bar with deterministic progress derived from lead data, behind feature flag.
4. Add `POST /api/v1/orcamentos/[id]/pdf` to generate server-side PDF with signed URL and base64 fallback.
5. Add rollout flags and health visibility:
   - `NEXT_PUBLIC_FF_PROFILE_AVATAR_V2`
   - `NEXT_PUBLIC_FF_NAV_COUNTS_V2`
   - `NEXT_PUBLIC_FF_LEADS_PROGRESS_V2`
   - `NEXT_PUBLIC_FF_ORCAMENTO_PDF_V2`

## Consequences

### Positive

- Restores user trust by removing fake/static UI cues.
- Keeps API v1 backward compatibility.
- Enables staged rollout and instant rollback by flags.
- Reuses existing PDF/storage pattern and telemetry conventions.

### Negative

- Adds short-term dual behavior while flags are staged.
- Orçamento PDF fallback may use base64 when storage bucket is unavailable.

## Rollback

1. Disable module flags individually (`FF_*_V2`).
2. If needed, disable `NEXT_PUBLIC_FF_UI_TAILADMIN_V1` for global UI fallback.
3. No database rollback required in this ADR (no migrations).
