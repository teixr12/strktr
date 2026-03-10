#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT_DIR/scripts/core-module-rollback-drill.sh" \
  "cronograma-ux-v2" \
  "Cronograma UX V2" \
  "NEXT_PUBLIC_FF_CRONOGRAMA_UX_V2" \
  "FF_CRONOGRAMA_UX_V2_CANARY_PERCENT" \
  "cronogramaUxV2Canary" \
  "npm run ops:cronograma-ux-v2:validate"
