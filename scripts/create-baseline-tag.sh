#!/usr/bin/env bash
set -euo pipefail

TAG_NAME="${1:-}"
if [[ -z "$TAG_NAME" ]]; then
  echo "Usage: ./scripts/create-baseline-tag.sh <tag-name>"
  echo "Example: ./scripts/create-baseline-tag.sh baseline/2026-02-26-stabilization"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is dirty. Commit or stash changes before creating a baseline tag."
  exit 1
fi

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG_NAME"
  exit 1
fi

git tag -a "$TAG_NAME" -m "Baseline snapshot: $TAG_NAME"

echo "Created tag: $TAG_NAME"
