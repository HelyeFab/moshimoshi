#!/usr/bin/env bash
# Guard: Prevent direct streak writes outside streakService.ts
# This script ensures all streak state modifications go through the single writer pattern

set -euo pipefail

echo "============================================================"
echo "Streak Write Guard - Single Writer Pattern Enforcement"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

violations_found=0

# Check 1: Direct writes to user_stats collection in gamification API routes (excluding load route - read-only)
echo "Check 1: Scanning for direct Firestore writes in gamification API routes..."
if command -v rg &> /dev/null; then
  # Use ripgrep if available (faster)
  api_violations=$(rg -n --type ts \
    -e "adminDb\.collection\('user_stats'\)" \
    -e 'adminDb\.collection\("user_stats"\)' \
    -e "getFirestore\(\)\.collection\('user_stats'\)" \
    -e 'getFirestore\(\)\.collection\("user_stats"\)' \
    -g 'src/app/api/gamification/**/*.ts' \
    -g '!src/app/api/gamification/load/**' \
    -g '!**/*.test.ts' \
    -g '!**/*.spec.ts' \
    || true)
else
  # Fallback to grep
  api_violations=$(grep -rn \
    -e "adminDb\.collection('user_stats')" \
    -e 'adminDb\.collection("user_stats")' \
    -e "getFirestore()\.collection('user_stats')" \
    -e 'getFirestore()\.collection("user_stats")' \
    --include="*.ts" \
    --exclude="*.test.ts" \
    --exclude="*.spec.ts" \
    --exclude-dir="load" \
    src/app/api/gamification/ \
    || true)
fi

if [[ -n "$api_violations" ]]; then
  echo -e "${RED}✗ FAILED${NC}: Found direct Firestore access in gamification API routes"
  echo ""
  echo "$api_violations"
  echo ""
  echo -e "${YELLOW}Fix:${NC} Use applyMergedStatsTransaction() from streakService.ts instead"
  violations_found=1
else
  echo -e "${GREEN}✓ PASSED${NC}: No direct Firestore access in gamification write routes"
fi

echo ""

# Check 2: Direct streak field writes in gamification routes (OK to have streak: { in data passed to service)
echo "Check 2: Scanning for Firestore .set() calls with streak fields in gamification routes..."
if command -v rg &> /dev/null; then
  streak_violations=$(rg -n --type ts \
    -e "\.set\(" \
    -e "\.update\(" \
    -g 'src/app/api/gamification/**/*.ts' \
    -g '!**/*.test.ts' \
    -g '!**/*.spec.ts' \
    | rg -e "userStatsRef" -e "user_stats" \
    || true)
else
  streak_violations=$(grep -rn \
    -e "\.set(" \
    -e "\.update(" \
    --include="*.ts" \
    --exclude="*.test.ts" \
    --exclude="*.spec.ts" \
    src/app/api/gamification/ \
    | grep -e "userStatsRef" -e "user_stats" \
    || true)
fi

if [[ -n "$streak_violations" ]]; then
  echo -e "${RED}✗ FAILED${NC}: Found direct .set()/.update() calls in gamification routes"
  echo ""
  echo "$streak_violations"
  echo ""
  echo -e "${YELLOW}Fix:${NC} Use applyMergedStatsTransaction() instead of direct Firestore calls"
  violations_found=1
else
  echo -e "${GREEN}✓ PASSED${NC}: No direct Firestore write operations in gamification routes"
fi

echo ""

# Check 3: Imports of getFirestore in gamification API routes (specific check)
echo "Check 3: Scanning for getFirestore imports in gamification API routes..."
if command -v rg &> /dev/null; then
  import_violations=$(rg -n --type ts \
    -e "import.*getFirestore.*from.*firebase-admin/firestore" \
    -g 'src/app/api/gamification/**/*.ts' \
    -g '!**/*.test.ts' \
    -g '!**/*.spec.ts' \
    || true)
else
  import_violations=$(grep -rn \
    -e "import.*getFirestore.*from.*firebase-admin/firestore" \
    --include="*.ts" \
    --exclude="*.test.ts" \
    --exclude="*.spec.ts" \
    src/app/api/gamification/ \
    || true)
fi

if [[ -n "$import_violations" ]]; then
  echo -e "${RED}✗ FAILED${NC}: Found getFirestore imports in gamification API routes"
  echo ""
  echo "$import_violations"
  echo ""
  echo -e "${YELLOW}Fix:${NC} Import from @/lib/gamification/services/streakService instead"
  violations_found=1
else
  echo -e "${GREEN}✓ PASSED${NC}: No getFirestore imports in gamification routes"
fi

echo ""
echo "============================================================"

if [[ $violations_found -eq 0 ]]; then
  echo -e "${GREEN}✓ All checks passed!${NC} Single writer pattern is maintained."
  echo ""
  exit 0
else
  echo -e "${RED}✗ Guard failed!${NC} Found violations of single writer pattern."
  echo ""
  echo "Acceptance Criteria:"
  echo "  1. All streak writes must go through streakService.ts"
  echo "  2. API routes must NOT import firebase-admin/firestore"
  echo "  3. API routes must delegate to applyMergedStatsTransaction()"
  echo ""
  echo "See docs/STREAK_MIGRATION_IMPLEMENTATION_2025-10-30.md for details"
  echo ""
  exit 1
fi
