#!/bin/bash
#
# Dark-Launch Phase 1: 10% Rollout
#
# Enables gamification features for 10% of users.
# Monitor closely for 30 minutes before proceeding to 50%.
#
# Usage:
#   ./scripts/rollout-10.sh
#   ./scripts/rollout-10.sh --production  # Requires confirmation
#
# Monitoring: Watch war room dashboard during rollout

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Dark-Launch Phase 1: 10% Rollout"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Determine environment
ENVIRONMENT=${1:---staging}
if [[ "$ENVIRONMENT" == "--production" ]]; then
  echo -e "${YELLOW}⚠️  Deploying to PRODUCTION${NC}"
  echo ""
  read -p "Confirm 10% production rollout (yes/no): " confirmation
  if [[ "$confirmation" != "yes" ]]; then
    echo "Rollout cancelled."
    exit 1
  fi
  ENV_FLAG="production"
else
  echo "Target environment: STAGING"
  ENV_FLAG="preview"
fi

echo ""
echo "Rollout Parameters:"
echo "  • Percentage: 10%"
echo "  • Expected users affected: ~1/10 of active users"
echo "  • Monitoring duration: 30 minutes minimum"
echo "  • Rollback ready: Yes"
echo ""

# Set feature flags with 10% rollout
echo "Setting feature flags..."
vercel env add GAMIFICATION_UNIFIED_ONLY true $ENV_FLAG --yes --force
vercel env add SYNC_ENABLED true $ENV_FLAG --yes --force
vercel env add LEADERBOARD_DELTAS true $ENV_FLAG --yes --force
vercel env add ROLLOUT_PERCENTAGE 10 $ENV_FLAG --yes --force
echo -e "${GREEN}✓ Flags configured${NC}"
echo ""

# Deploy
echo "Deploying..."
START=$(date +%s)
if [[ "$ENV_FLAG" == "production" ]]; then
  vercel --prod --yes
else
  vercel --yes
fi
END=$(date +%s)
DEPLOY_TIME=$((END - START))
echo -e "${GREEN}✓ Deployed in ${DEPLOY_TIME}s${NC}"
echo ""

# Post-deploy monitoring instructions
echo "═══════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 MONITORING PHASE (30 minutes)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Watch these metrics in war room dashboard:"
echo "  1. API Error Rate (abort if > 2%)"
echo "  2. P95 Latency (abort if > 300ms)"
echo "  3. Sync Queue Size (abort if > 500)"
echo "  4. User complaints (abort if > 5 in 10 min)"
echo ""
echo "Decision points:"
echo "  ✅ All metrics green for 30 min → Proceed to 50%"
echo "  ⚠️  Minor issues → Investigate, hold at 10%"
echo "  ❌ Major issues → Run ./scripts/rollback-all.sh"
echo ""
echo "Next step (after 30 min):"
echo "  ./scripts/rollout-50.sh $ENVIRONMENT"
echo "═══════════════════════════════════════════════════════════"
