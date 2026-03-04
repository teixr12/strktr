# ADR 0040: Construction Docs media read-path uses signed URLs

- Date: 2026-03-04
- Status: Accepted
- Owners: Platform / Construction Docs

## Context

Construction Docs media bucket is configured as private, but photo records and UI relied on `url` generated via `getPublicUrl`.

For private buckets this can produce inaccessible links and inconsistent image rendering. Additionally, visit details fetched annotations by org and filtered in memory, creating unnecessary read amplification.

## Decision

Apply additive hardening without changing route contracts:

1. On upload, try signed URL first and keep `url` field populated with a usable access URL fallback.
2. On `GET /api/v1/construction-docs/visits/:visitId`, resolve `signed_url` per photo using storage key and bucket metadata.
3. Keep legacy `url` in payload; add `signed_url` as additive field for clients.
4. Scope annotations query by `photo_id in (...)` for the current visit photos.

## Consequences

- Positive:
  - Reliable image access for private buckets.
  - Backward compatibility preserved (`url` remains).
  - Lower annotation over-fetch in visit payloads.
- Trade-off:
  - Slight extra read cost for signed URL generation per photo.
- Rollback:
  - Revert this patch and return to legacy `url`-only read path.
