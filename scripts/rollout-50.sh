#!/bin/bash
#
# Dark-Launch Phase 2: 50% Rollout
#
# Enables gamification features for 50% of users.
# Monitor for 1 hour before proceeding to 100%.
#
# Prerequisites: 10% rollout successful for 30+ minutes
#
# Usage:
#   ./scripts/rollout-50.sh
#   ./scripts/rollout-50.sh --production

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Dark-Launch Phase 2: 50% Rollout"
echo "═══════════════════════════════════════════════════════════"
echo ""

ENVIRONMENT=${1:---staging}
if [[ "$ENVIRONMENT" == "--production" ]]; then
  echo -e "${YELLOW}⚠️  Deploying to PRODUCTION${NC}"
  echo ""
  echo "Prerequisites checklist:"
  echo "  [ ] 10% rollout stable for 30+ minutes"
  echo "  [ ] Error rate < 1%"
  echo "  [ ] P95 latency < 200ms"
  echo "  [ ] No major user complaints"
  echo ""
  read -p "All prerequisites met? (yes/no): " confirmation
  if [[ "$confirmation" != "yes" ]]; then
    echo "Rollout cancelled. Fix issues at 10% first."
    exit 1
  fi
  ENV_FLAG="production"
else
  ENV_FLAG="preview"
fi

echo ""
echo "Rollout Parameters:"
echo "  • Percentage: 50% (5x increase from 10%)"
echo "  • Monitoring duration: 1 hour minimum"
echo "  • Rollback ready: Yes"
echo ""

echo "Updating rollout percentage..."
vercel env add ROLLOUT_PERCENTAGE 50 $ENV_FLAG --yes --force
echo -e "${GREEN}✓ Rollout percentage updated to 50%${NC}"
echo ""

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

echo "═══════════════════════════════════════════════════════════"
echo -e "${BLUE}📊 MONITORING PHASE (1 hour)${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Critical metrics to watch:"
echo "  1. API Error Rate (abort if > 2%)"
echo "  2. P95 Latency (abort if > 300ms)"
echo "  3. Sync Queue Size (abort if > 1000)"
echo "  4. Throughput (should increase ~5x)"
echo ""
echo "Decision points:"
echo "  ✅ All metrics stable for 1 hour → Proceed to 100%"
echo "  ⚠️  Minor degradation → Hold at 50%, investigate"
echo "  ❌ Significant issues → Rollback to 10% or 0%"
echo ""
echo "Next step (after 1 hour):"
echo "  ./scripts/rollout-100.sh $ENVIRONMENT"
echo "═══════════════════════════════════════════════════════════"
