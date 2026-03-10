#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT_DIR/scripts/core-module-rollback-drill.sh" \
  "portal-admin-v2" \
  "Portal Admin V2" \
  "NEXT_PUBLIC_FF_PORTAL_ADMIN_V2" \
  "FF_PORTAL_ADMIN_V2_CANARY_PERCENT" \
  "portalAdminV2Canary" \
  "npm run ops:portal-admin-v2:validate"
