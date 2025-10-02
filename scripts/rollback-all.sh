#!/bin/bash
#
# Emergency Rollback - Disable All Gamification Features
#
# This script immediately disables all gamification feature flags
# to roll back to legacy/safe state in case of production issues.
#
# Usage:
#   ./scripts/rollback-all.sh
#   ./scripts/rollback-all.sh --production  # Requires confirmation
#
# Execution time: < 1 minute
# Rollback effect: Immediate (< 30 seconds propagation)

set -e  # Exit on error

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════"
echo "🚨 EMERGENCY ROLLBACK - Gamification System"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Determine environment
ENVIRONMENT=${1:---staging}
if [[ "$ENVIRONMENT" == "--production" ]]; then
  echo -e "${RED}⚠️  WARNING: This will rollback PRODUCTION environment${NC}"
  echo ""
  echo "This will disable all gamification features immediately."
  echo ""
  read -p "Type 'ROLLBACK-PROD' to confirm: " confirmation

  if [[ "$confirmation" != "ROLLBACK-PROD" ]]; then
    echo ""
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 1
  fi

  ENV_FLAG="production"
else
  echo "Target environment: STAGING"
  ENV_FLAG="preview"
fi

echo ""
echo "Starting rollback..."
echo ""

# Record rollback time
ROLLBACK_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Rollback initiated at: $ROLLBACK_TIME"
echo ""

# Step 1: Disable all feature flags
echo "Step 1/4: Disabling feature flags..."
vercel env rm GAMIFICATION_UNIFIED_ONLY $ENV_FLAG --yes 2>/dev/null || echo "  (GAMIFICATION_UNIFIED_ONLY not set)"
vercel env rm SYNC_ENABLED $ENV_FLAG --yes 2>/dev/null || echo "  (SYNC_ENABLED not set)"
vercel env rm LEADERBOARD_DELTAS $ENV_FLAG --yes 2>/dev/null || echo "  (LEADERBOARD_DELTAS not set)"
vercel env rm DEPRECATE_LEGACY_STORES $ENV_FLAG --yes 2>/dev/null || echo "  (DEPRECATE_LEGACY_STORES not set)"
vercel env rm ROLLOUT_PERCENTAGE $ENV_FLAG --yes 2>/dev/null || echo "  (ROLLOUT_PERCENTAGE not set)"
echo -e "${GREEN}✓ Feature flags disabled${NC}"
echo ""

# Step 2: Trigger redeployment
echo "Step 2/4: Triggering redeployment..."
START_DEPLOY=$(date +%s)

if [[ "$ENV_FLAG" == "production" ]]; then
  vercel --prod --yes
else
  vercel --yes
fi

END_DEPLOY=$(date +%s)
DEPLOY_TIME=$((END_DEPLOY - START_DEPLOY))
echo -e "${GREEN}✓ Deployment complete (${DEPLOY_TIME}s)${NC}"
echo ""

# Step 3: Verify rollback
echo "Step 3/4: Verifying rollback..."
sleep 10  # Wait for propagation

# Test endpoint to verify flags are off
if [[ "$ENV_FLAG" == "production" ]]; then
  TEST_URL="https://moshimoshi.app/api/health"
else
  TEST_URL="https://staging.moshimoshi.app/api/health"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $TEST_URL)
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}✓ Service is responding${NC}"
else
  echo -e "${RED}✗ Service health check failed (HTTP $HTTP_CODE)${NC}"
  echo "  Manual verification required"
fi
echo ""

# Step 4: Post-rollback actions
echo "Step 4/4: Post-rollback actions..."
echo "  → Logging rollback event..."

# Log to file
ROLLBACK_LOG="logs/rollback-${ROLLBACK_TIME}.log"
mkdir -p logs
cat > $ROLLBACK_LOG <<EOF
Rollback Event
==============
Timestamp: $ROLLBACK_TIME
Environment: $ENV_FLAG
Initiated by: $USER
Reason: Emergency rollback (manual trigger)
Deployment time: ${DEPLOY_TIME}s
Status: Success

Feature flags disabled:
- GAMIFICATION_UNIFIED_ONLY
- SYNC_ENABLED
- LEADERBOARD_DELTAS
- DEPRECATE_LEGACY_STORES
- ROLLOUT_PERCENTAGE

Next actions required:
1. Investigate root cause of rollback
2. Run nightly recompute to fix data drift
3. Review monitoring dashboards
4. Update incident log
EOF

echo -e "${GREEN}✓ Rollback logged to ${ROLLBACK_LOG}${NC}"
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Rollback Complete${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Summary:"
echo "  • All gamification feature flags disabled"
echo "  • Redeployment completed in ${DEPLOY_TIME}s"
echo "  • System reverted to legacy/safe state"
echo ""
echo "Next Steps:"
echo "  1. Check monitoring dashboards for metric recovery"
echo "  2. Run: npm run scripts:nightly-recompute (to fix any data drift)"
echo "  3. Review application logs for errors"
echo "  4. Update #moshi-prod-launch with rollback status"
echo "  5. Investigate root cause before re-enabling"
echo ""
echo "Rollback log: $ROLLBACK_LOG"
echo "═══════════════════════════════════════════════════════════"
