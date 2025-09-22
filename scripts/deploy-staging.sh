#!/bin/bash

# Staging Deployment Script
# Monday Morning Task - Deploy RC 1.0.0 to staging

set -e

# Configuration
NAMESPACE="staging"
VERSION="1.0.0"
REGISTRY="gcr.io/moshimoshi-staging"
APP_NAME="moshimoshi"

echo "======================================"
echo "Staging Deployment - Version $VERSION"
echo "======================================"
echo ""

# Step 1: Build and push Docker image
echo "[1/5] Building Docker image..."
docker build -f Dockerfile.production -t $REGISTRY/$APP_NAME:$VERSION .
docker push $REGISTRY/$APP_NAME:$VERSION

# Step 2: Create/Update staging namespace
echo "[2/5] Setting up staging namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Step 3: Apply staging configurations
echo "[3/5] Applying staging configurations..."

# Create staging-specific values
cat > k8s/staging-values.yaml <<EOF
namespace: staging
image: $REGISTRY/$APP_NAME:$VERSION
replicas: 2
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
environment:
  NODE_ENV: "staging"
  DATABASE_URL: "postgresql://staging:password@postgres-staging:5432/moshimoshi_staging"
  REDIS_URL: "redis://redis-staging:6379"
  NEXTAUTH_URL: "https://staging.moshimoshi.app"
EOF

# Deploy to staging
kubectl apply -f k8s/deployment-blue.yaml -n $NAMESPACE
kubectl set image deployment/moshimoshi-blue moshimoshi=$REGISTRY/$APP_NAME:$VERSION -n $NAMESPACE

# Step 4: Wait for rollout
echo "[4/5] Waiting for deployment to complete..."
kubectl rollout status deployment/moshimoshi-blue -n $NAMESPACE --timeout=300s

# Step 5: Run health checks
echo "[5/5] Running health checks..."
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=moshimoshi,version=blue -o jsonpath='{.items[0].metadata.name}')

kubectl exec -n $NAMESPACE $POD_NAME -- curl -f http://localhost:3000/api/health || {
    echo "Health check failed!"
    exit 1
}

echo ""
echo "✅ Staging deployment completed successfully!"
echo ""
echo "Access staging at: https://staging.moshimoshi.app"
echo "Run smoke tests: ./scripts/test-staging.sh"
echo "Run load tests: ./scripts/load-test-staging.sh"