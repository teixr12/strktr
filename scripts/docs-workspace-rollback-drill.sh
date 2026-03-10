#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT_DIR/scripts/core-module-rollback-drill.sh" \
  "docs-workspace" \
  "Docs Workspace V1" \
  "NEXT_PUBLIC_FF_DOCS_WORKSPACE_V1" \
  "FF_DOCS_WORKSPACE_CANARY_PERCENT" \
  "docsWorkspaceCanary" \
  "npm run ops:docs-workspace:validate"
