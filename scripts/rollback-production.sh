#!/bin/bash

# Emergency Rollback Script for Moshimoshi Production
# Executes rollback in under 5 minutes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
NAMESPACE="production"
ROLLBACK_REASON="${1:-Emergency rollback initiated}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Timer
START_TIME=$(date +%s)

log_error() {
    echo -e "${RED}[ROLLBACK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[ROLLBACK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[ROLLBACK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

notify_slack() {
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 ROLLBACK: $1\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Step 1: Identify current active environment (30 seconds)
log_warning "Step 1: Identifying active environment..."
CURRENT_ENV=$(kubectl get service moshimoshi-active -n $NAMESPACE \
    -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "unknown")

if [ "$CURRENT_ENV" == "blue" ]; then
    TARGET_ENV="green"
else
    TARGET_ENV="blue"
fi

log_success "Current: $CURRENT_ENV, Rolling back to: $TARGET_ENV"

# Step 2: Quick health check of target environment (30 seconds)
log_warning "Step 2: Verifying target environment health..."
READY_REPLICAS=$(kubectl get deployment moshimoshi-$TARGET_ENV -n $NAMESPACE \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")

if [ "$READY_REPLICAS" -lt "1" ]; then
    log_error "Target environment not ready. Attempting to scale up..."
    kubectl scale deployment moshimoshi-$TARGET_ENV -n $NAMESPACE --replicas=3
    sleep 10
fi

# Step 3: Immediate traffic switch (1 minute)
log_warning "Step 3: Switching traffic to $TARGET_ENV..."
notify_slack "Switching traffic from $CURRENT_ENV to $TARGET_ENV"

# Disable canary immediately
kubectl patch ingress moshimoshi-ingress-canary -n $NAMESPACE \
    -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary":"false"}}}' \
    --type merge || true

# Switch active service
kubectl patch service moshimoshi-active -n $NAMESPACE \
    -p "{\"spec\":{\"selector\":{\"version\":\"$TARGET_ENV\"}}}" \
    --type merge

log_success "Traffic switched to $TARGET_ENV"

# Step 4: Clear caches (30 seconds)
log_warning "Step 4: Clearing caches..."

# Clear CDN cache if using CloudFlare
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json" \
        --data '{"purge_everything":true}' 2>/dev/null || true
fi

# Clear Redis cache
kubectl exec -n $NAMESPACE deployment/redis -- redis-cli FLUSHALL 2>/dev/null || true

log_success "Caches cleared"

# Step 5: Validate rollback (30 seconds)
log_warning "Step 5: Validating rollback..."

# Get service endpoint
SERVICE_IP=$(kubectl get service moshimoshi-active -n $NAMESPACE \
    -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

if [ -n "$SERVICE_IP" ]; then
    # Check health endpoint
    if curl -f -s -o /dev/null -w "%{http_code}" "http://$SERVICE_IP/api/health" | grep -q "200"; then
        log_success "Health check passed"
    else
        log_error "Health check failed but continuing..."
    fi
fi

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

log_success "ROLLBACK COMPLETED in ${ELAPSED} seconds"
notify_slack "Rollback completed in ${ELAPSED} seconds. Reason: $ROLLBACK_REASON"

# Log rollback event
cat >> rollback.log <<EOF
Timestamp: $(date)
From: $CURRENT_ENV
To: $TARGET_ENV
Reason: $ROLLBACK_REASON
Duration: ${ELAPSED}s
Operator: ${USER}
EOF

# Print next steps
echo ""
log_warning "NEXT STEPS:"
echo "1. Verify application functionality"
echo "2. Check monitoring dashboards"
echo "3. Review error logs: kubectl logs -n $NAMESPACE -l version=$TARGET_ENV"
echo "4. Notify stakeholders"
echo "5. Conduct post-mortem"

exit 0