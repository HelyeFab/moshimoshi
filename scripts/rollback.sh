#!/bin/bash

# Emergency Rollback Script
# Quickly rollback to previous deployment in case of issues

set -e

NAMESPACE="moshimoshi"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${RED}[EMERGENCY ROLLBACK]${NC} Initiating emergency rollback procedure..."

# Get current deployments
CURRENT=$(kubectl get service moshimoshi-service -n $NAMESPACE -o jsonpath='{.spec.selector.version}')

if [ "$CURRENT" == "blue" ]; then
    TARGET="green"
else
    TARGET="blue"
fi

echo -e "${YELLOW}[INFO]${NC} Current deployment: $CURRENT"
echo -e "${YELLOW}[INFO]${NC} Rolling back to: $TARGET"

# Check if target deployment has running pods
REPLICAS=$(kubectl get deployment moshimoshi-$TARGET -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')

if [ "$REPLICAS" == "0" ] || [ -z "$REPLICAS" ]; then
    echo -e "${YELLOW}[WARNING]${NC} No running pods in $TARGET deployment. Scaling up..."
    kubectl scale deployment moshimoshi-$TARGET -n $NAMESPACE --replicas=3
    
    echo -e "${YELLOW}[INFO]${NC} Waiting for pods to be ready..."
    kubectl rollout status deployment/moshimoshi-$TARGET -n $NAMESPACE --timeout=120s
fi

# Switch traffic immediately
echo -e "${YELLOW}[INFO]${NC} Switching traffic to $TARGET..."
kubectl patch service moshimoshi-service -n $NAMESPACE \
    -p '{"spec":{"selector":{"version":"'$TARGET'"}}}'

echo -e "${GREEN}[SUCCESS]${NC} Traffic switched to $TARGET deployment"

# Scale down failed deployment
echo -e "${YELLOW}[INFO]${NC} Scaling down failed deployment..."
kubectl scale deployment moshimoshi-$CURRENT -n $NAMESPACE --replicas=0

echo -e "${GREEN}[COMPLETE]${NC} Emergency rollback completed successfully!"
echo -e "${YELLOW}[ACTION REQUIRED]${NC} Please investigate the cause of failure in $CURRENT deployment"

# Send alert
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST $SLACK_WEBHOOK_URL \
        -H 'Content-Type: application/json' \
        -d '{"text":"🔄 Emergency rollback executed from '$CURRENT' to '$TARGET'"}'
fi