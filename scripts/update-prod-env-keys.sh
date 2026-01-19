#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not found. Install it first: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.env.local" ]]; then
  echo "Missing .env.local in $ROOT_DIR"
  exit 1
fi

if [[ ! -f "$ROOT_DIR/moshimoshi-service-account.json" ]]; then
  echo "Missing moshimoshi-service-account.json in $ROOT_DIR"
  exit 1
fi

echo "Updating production environment variables from local files..."

python3 - <<'PY' | vercel env add NEXT_PUBLIC_RECAPTCHA_SITE_KEY production --force
import re
from pathlib import Path
text = Path('.env.local').read_text()
m = re.findall(r'^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=(.*)$', text, flags=re.MULTILINE)
if not m:
    raise SystemExit('NEXT_PUBLIC_RECAPTCHA_SITE_KEY not found in .env.local')
print(m[-1].strip(), end='')
PY

python3 - <<'PY' | vercel env add RECAPTCHA_SECRET_KEY production --force
import re
from pathlib import Path
text = Path('.env.local').read_text()
m = re.findall(r'^RECAPTCHA_SECRET_KEY=(.*)$', text, flags=re.MULTILINE)
if not m:
    raise SystemExit('RECAPTCHA_SECRET_KEY not found in .env.local')
print(m[-1].strip(), end='')
PY

python3 - <<'PY' | vercel env add FIREBASE_ADMIN_PRIVATE_KEY production --force
import json
print(json.load(open('moshimoshi-service-account.json'))['private_key'], end='')
PY

echo "Done. Now redeploy with: vercel deploy --prod"
