#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
STAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT="docs/reports/production-audit-${STAMP}.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

HEALTH_OUT="$TMP_DIR/health.json"
RELEASE_OUT="$TMP_DIR/release.json"
MIGRATIONS_OUT="$TMP_DIR/migrations.json"
RLS_OUT="$TMP_DIR/rls.json"
NULLS_OUT="$TMP_DIR/org_id_nulls.json"

HEALTH_STATUS="unknown"
if /usr/bin/curl -4 -sS --connect-timeout 5 -m 20 \
  "https://strktr.vercel.app/api/v1/health/ops" > "$HEALTH_OUT"; then
  HEALTH_STATUS="ok"
else
  HEALTH_STATUS="failed"
fi

RELEASE_STATUS="unknown"
if /usr/bin/curl -4 -sS --connect-timeout 5 -m 20 \
  "https://strktr.vercel.app/api/v1/ops/release" > "$RELEASE_OUT"; then
  RELEASE_STATUS="ok"
else
  RELEASE_STATUS="failed"
fi

MIGRATIONS_STATUS="skipped"
if [[ -f "supabase_keys.env.codex.txt" ]]; then
  if ./scripts/supabase-query.sh supabase/sql/audit_migrations_applied.sql > "$MIGRATIONS_OUT"; then
    MIGRATIONS_STATUS="ok"
  else
    MIGRATIONS_STATUS="failed"
  fi

  if ./scripts/supabase-query.sh supabase/sql/audit_tenancy_rls_status.sql > "$RLS_OUT"; then
    RLS_STATUS="ok"
  else
    RLS_STATUS="failed"
  fi

  if ./scripts/supabase-query.sh supabase/sql/audit_org_id_nulls.sql > "$NULLS_OUT"; then
    NULLS_STATUS="ok"
  else
    NULLS_STATUS="failed"
  fi
else
  RLS_STATUS="skipped"
  NULLS_STATUS="skipped"
fi

{
  echo "# STRKTR Production Audit"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- HealthCheck: ${HEALTH_STATUS}"
  echo "- ReleaseMarker: ${RELEASE_STATUS}"
  echo "- SupabaseMigrationsAudit: ${MIGRATIONS_STATUS}"
  echo "- SupabaseRlsAudit: ${RLS_STATUS:-skipped}"
  echo "- SupabaseOrgIdNullsAudit: ${NULLS_STATUS:-skipped}"
  echo
  echo "## Health Endpoint"
  echo '```json'
  cat "$HEALTH_OUT" 2>/dev/null || true
  echo
  echo '```'
  echo
  echo "## Release Marker Endpoint"
  echo '```json'
  cat "$RELEASE_OUT" 2>/dev/null || true
  echo
  echo '```'
  echo
  echo "## Applied Migrations"
  echo '```json'
  cat "$MIGRATIONS_OUT" 2>/dev/null || true
  echo
  echo '```'
  echo
  echo "## Tenancy/RLS Audit"
  echo '```json'
  cat "$RLS_OUT" 2>/dev/null || true
  echo
  echo '```'
  echo
  echo "## org_id Null Audit"
  echo '```json'
  cat "$NULLS_OUT" 2>/dev/null || true
  echo
  echo '```'
} > "$REPORT"

echo "Production audit generated: $REPORT"
