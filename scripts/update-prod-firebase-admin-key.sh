#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not found. Install it first: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/moshimoshi-service-account.json" ]]; then
  echo "Missing moshimoshi-service-account.json in $ROOT_DIR"
  exit 1
fi

cd "$ROOT_DIR"

python3 - <<'PY' | vercel env add FIREBASE_ADMIN_PRIVATE_KEY production --force
import json
print(json.load(open('moshimoshi-service-account.json'))['private_key'], end='')
PY

echo "Done. Redeploy with: vercel deploy --prod"
