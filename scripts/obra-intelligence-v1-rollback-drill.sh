#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT_DIR/scripts/core-module-rollback-drill.sh" \
  "obra-intelligence-v1" \
  "Obra Intelligence V1" \
  "NEXT_PUBLIC_FF_OBRA_INTELLIGENCE_V1" \
  "FF_OBRA_INTELLIGENCE_V1_CANARY_PERCENT" \
  "obraIntelligenceV1Canary" \
  "npm run ops:obra-intelligence-v1:validate"
