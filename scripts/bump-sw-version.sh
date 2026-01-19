#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found. Install git to generate a version."
  exit 1
fi

VERSION="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"

if [[ ! -f ".env.local" ]]; then
  echo "Missing .env.local in $ROOT_DIR"
  exit 1
fi

# Update or append NEXT_PUBLIC_SW_VERSION in .env.local
if rg -q "^NEXT_PUBLIC_SW_VERSION=" .env.local; then
  python3 - <<'PY'
import re
from pathlib import Path
path = Path('.env.local')
text = path.read_text()
text = re.sub(r'^NEXT_PUBLIC_SW_VERSION=.*$', f'NEXT_PUBLIC_SW_VERSION={__import__("os").environ["SW_VERSION"]}', text, flags=re.MULTILINE)
path.write_text(text)
PY
else
  echo "" >> .env.local
  echo "NEXT_PUBLIC_SW_VERSION=$VERSION" >> .env.local
fi

echo "Bumped NEXT_PUBLIC_SW_VERSION to: $VERSION"

if command -v vercel >/dev/null 2>&1; then
  echo "Updating Vercel production env: NEXT_PUBLIC_SW_VERSION"
  if ! printf '%s' "$VERSION" | vercel env add NEXT_PUBLIC_SW_VERSION production --force; then
    echo "Failed to update Vercel env. You may need to login: vercel login"
    exit 1
  fi
else
  echo "vercel CLI not found. Install it to auto-update prod env:"
  echo "  npm i -g vercel"
fi

echo "Redeploy to apply the new SW version:"
echo "  vercel deploy --prod"
