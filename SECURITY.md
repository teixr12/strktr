# Security Policy

## Supported Model
STRKTR uses:
- Supabase Auth + RLS org-first
- Next.js server routes with bearer token validation
- Feature-flagged rollouts for sensitive changes

## Reporting a Vulnerability
Send security reports privately to the platform owner.
Do not open a public issue with exploit details.

## Mandatory Security Controls
- No secrets committed to git.
- All production writes must be API-first and authenticated.
- RLS policies must enforce org isolation.
- Critical actions must log `requestId`, `orgId`, and `userId`.

## Secret Hygiene
Sensitive values that must be rotated on exposure:
- `VERCEL_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`

## Rotation Cadence
- Routine rotation: every 90 days.
- Emergency rotation: immediately after suspected leak.

## Incident Response
Follow runbooks:
- `docs/runbooks/incident-api-rls-cron.md`
- `docs/runbooks/credential-rotation.md`
