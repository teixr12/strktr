#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT_DIR/scripts/core-module-rollback-drill.sh" \
  "finance-receipt-ai" \
  "Finance Receipt AI" \
  "NEXT_PUBLIC_FF_FINANCE_RECEIPT_AI_V1" \
  "FF_FINANCE_RECEIPT_AI_CANARY_PERCENT" \
  "financeReceiptAiCanary" \
  "npm run ops:finance-receipt-ai:validate"
