#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/reports
REPORT="docs/reports/baseline-$(date '+%Y%m%d-%H%M%S').md"

BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"
HEAD_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
HEAD_SUBJECT="$(git log -1 --pretty=%s 2>/dev/null || echo unknown)"
STATUS_COUNT="$(git status --short | wc -l | tr -d ' ')"

{
  echo "# STRKTR Baseline Snapshot"
  echo
  echo "- GeneratedAt: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- Branch: ${BRANCH}"
  echo "- Head: ${HEAD_SHA}"
  echo "- HeadSubject: ${HEAD_SUBJECT}"
  echo "- ChangedFilesCount: ${STATUS_COUNT}"
  echo
  echo "## Changed Files (git status --short)"
  echo '```'
  git status --short || true
  echo '```'
  echo
  echo "## Local Governance Checks"
  echo "- lint: pending"
  echo "- build: pending"
  echo "- validate:api-contracts: pending"
  echo "- test:e2e: pending"
  echo
  echo "## Production Health (optional)"
  echo "- Command: curl -s https://strktr.vercel.app/api/v1/health/ops"
  echo
  echo "## Supabase Migrations Audit (optional)"
  echo "- Command: ./scripts/supabase-query.sh supabase/sql/audit_migrations_applied.sql"
  echo
  echo "## Tenant/RLS Audit (optional)"
  echo "- Command: ./scripts/supabase-query.sh supabase/sql/audit_tenancy_rls_status.sql"
} > "$REPORT"

echo "Baseline report generated: $REPORT"
