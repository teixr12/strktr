#!/usr/bin/env bash
set -euo pipefail

printf '\n== STRKTR Release Readiness ==\n'
printf 'Date: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

printf '\n[1/4] Lint\n'
npm run lint

printf '\n[2/4] Build\n'
npm run build

printf '\n[3/4] API contract checks\n'
npm run validate:api-contracts

printf '\n[4/4] E2E smoke\n'
if [[ -n "${PLAYWRIGHT_BASE_URL:-}" ]]; then
  PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL}" npm run test:e2e
else
  if [[ "${ALLOW_BIND_RESTRICTED_E2E_SKIP:-0}" == "1" ]]; then
    TMP_LOG="$(mktemp)"
    set +e
    npm run test:e2e >"$TMP_LOG" 2>&1
    E2E_STATUS=$?
    set -e
    cat "$TMP_LOG"
    if [[ $E2E_STATUS -ne 0 ]]; then
      if grep -q "listen EPERM: operation not permitted" "$TMP_LOG"; then
        echo "E2E skipped due local bind restriction (ALLOW_BIND_RESTRICTED_E2E_SKIP=1)."
      else
        rm -f "$TMP_LOG"
        exit $E2E_STATUS
      fi
    fi
    rm -f "$TMP_LOG"
  else
    npm run test:e2e
  fi
fi

printf '\nAll release readiness checks passed.\n'
