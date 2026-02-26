# Credential Rotation Runbook

## Scope
Rotate critical credentials safely without downtime.

## Credentials
- `VERCEL_TOKEN`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD`

## Procedure
1. Create new credential in provider console.
2. Update secret in Vercel/Supabase environment.
3. Validate health endpoints and critical API calls.
4. Revoke old credential.
5. Record rotation date and owner.

## Emergency rotation
For leaked credentials, execute immediately and force revoke old keys.
