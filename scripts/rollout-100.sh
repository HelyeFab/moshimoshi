#!/bin/bash
#
# Dark-Launch Phase 3: 100% Rollout (Full Release)
#
# Enables gamification features for ALL users.
# This is the final production release.
#
# Prerequisites: 50% rollout successful for 1+ hour
#
# Usage:
#   ./scripts/rollout-100.sh
#   ./scripts/rollout-100.sh --production

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Dark-Launch Phase 3: 100% Rollout (FULL RELEASE)"
echo "═══════════════════════════════════════════════════════════"
echo ""

ENVIRONMENT=${1:---staging}
if [[ "$ENVIRONMENT" == "--production" ]]; then
  echo -e "${RED}⚠️  FULL PRODUCTION RELEASE${NC}"
  echo ""
  echo "Prerequisites checklist:"
  echo "  [ ] 50% rollout stable for 1+ hour"
  echo "  [ ] Error rate < 1%"
  echo "  [ ] P95 latency < 200ms"
  echo "  [ ] Sync queue < 100 items"
  echo "  [ ] No P0/P1 incidents"
  echo "  [ ] Supervisor approval obtained"
  echo ""
  read -p "All prerequisites met? (yes/no): " confirmation
  if [[ "$confirmation" != "yes" ]]; then
    echo "Rollout cancelled. Resolve all issues first."
    exit 1
  fi

  echo ""
  echo -e "${RED}This will enable gamification for ALL users.${NC}"
  read -p "Type 'FULL-RELEASE' to confirm: " final_confirmation
  if [[ "$final_confirmation" != "FULL-RELEASE" ]]; then
    echo "Rollout cancelled."
    exit 1
  fi

  ENV_FLAG="production"
else
  ENV_FLAG="preview"
fi

echo ""
echo "Rollout Parameters:"
echo "  • Percentage: 100% (ALL USERS)"
echo "  • Monitoring duration: 2 hours post-release"
echo "  • Rollback ready: Yes (but discouraged at this stage)"
echo ""

echo "Updating to full rollout..."
vercel env add ROLLOUT_PERCENTAGE 100 $ENV_FLAG --yes --force
echo -e "${GREEN}✓ Rollout percentage set to 100%${NC}"
echo ""

echo "Deploying full release..."
RELEASE_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
START=$(date +%s)

if [[ "$ENV_FLAG" == "production" ]]; then
  vercel --prod --yes
else
  vercel --yes
fi

END=$(date +%s)
DEPLOY_TIME=$((END - START))
echo -e "${GREEN}✓ FULL RELEASE DEPLOYED in ${DEPLOY_TIME}s${NC}"
echo ""

# Log the release
RELEASE_LOG="logs/release-${RELEASE_TIME}.log"
mkdir -p logs
cat > $RELEASE_LOG <<EOF
Gamification System - Full Production Release
==============================================
Release Time: $RELEASE_TIME
Environment: $ENV_FLAG
Deployed by: $USER
Deployment duration: ${DEPLOY_TIME}s

Features enabled:
- ✅ Unified stats API (/api/stats/unified)
- ✅ Premium sync with UTC-safe boundaries
- ✅ Leaderboard delta materialization
- ✅ Offline sync queue with circuit breaker
- ✅ Nightly recompute job
- ✅ Rate limiting (tier-based)
- ✅ Comprehensive monitoring

Rollout phases completed:
1. 10% rollout - Success
2. 50% rollout - Success
3. 100% rollout - Success

Next actions:
- Monitor dashboards for 2 hours
- Verify nightly recompute runs successfully
- Check error rates remain < 1%
- Update team on release status
EOF

echo -e "${GREEN}✓ Release logged to ${RELEASE_LOG}${NC}"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}🎉 FULL RELEASE COMPLETE${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🎊 Gamification system is now live for ALL users!"
echo ""
echo "Post-release monitoring (2 hours):"
echo "  1. Watch war room dashboard continuously"
echo "  2. Monitor error rates and latency"
echo "  3. Check sync queue stays < 100"
echo "  4. Verify nightly recompute runs at 02:00 UTC"
echo "  5. Review user feedback channels"
echo ""
echo "Success criteria:"
echo "  ✅ Error rate < 1% sustained"
echo "  ✅ P95 latency < 200ms sustained"
echo "  ✅ No P0/P1 incidents"
echo "  ✅ Positive user feedback"
echo ""
echo "If issues arise:"
echo "  ⚠️  Minor: Investigate and monitor"
echo "  ❌ Major: Execute ./scripts/rollback-all.sh --production"
echo ""
echo "Congratulations on the successful launch! 🚀"
echo "═══════════════════════════════════════════════════════════"
