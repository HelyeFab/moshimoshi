#!/usr/bin/env bash
set -euo pipefail

# Guard to ensure the removed Firestore collection `streak_validations` is not reintroduced in runtime code.
# Allowed occurrences: docs/, user-phoenix/, firestore.rules, firestore.dual-storage.rules, this guard script.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN="streak_validations"

# Search only runtime code directories
SEARCH_DIRS=(
  "src"
  "functions"
)

# Build grep include file types
INCLUDES=("*.ts" "*.tsx" "*.js" "*.jsx" "*.mjs" "*.cjs" "*.mts" "*.cts")

# Construct grep command args
INCLUDE_ARGS=( )
for inc in "${INCLUDES[@]}"; do
  INCLUDE_ARGS+=( --include="$inc" )
done

# Exclusions
EXCLUDES=(
  "node_modules"
  ".git"
  "docs"
  "user-phoenix"
)
EXCLUDE_ARGS=( )
for exc in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=( --exclude-dir="$exc" )
done

MATCHES=""
for dir in "${SEARCH_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    # shellcheck disable=SC2086
    FOUND=$(grep -RInI ${INCLUDE_ARGS[@]} ${EXCLUDE_ARGS[@]} "$PATTERN" "$dir" || true)
    if [ -n "$FOUND" ]; then
      MATCHES+="$FOUND
"
    fi
  fi
done

if [ -n "$MATCHES" ]; then
  echo "❌ CI guard failed: Found forbidden references to '$PATTERN' in runtime code:" >&2
  echo "$MATCHES" >&2
  exit 1
fi

echo "✅ CI guard passed: '$PATTERN' not found in runtime code."
