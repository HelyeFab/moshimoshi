#!/bin/bash

# Blue-Green Deployment Script with Automated Rollback
# Moshimoshi Review Engine Production Deployment

set -e

# Configuration
NAMESPACE="moshimoshi"
DEPLOYMENT_TIMEOUT=300
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=10
ROLLBACK_ON_FAILURE=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_error "Namespace $NAMESPACE not found."
        exit 1
    fi
    
    log_success "Prerequisites check passed."
}

# Get current active deployment (blue or green)
get_active_deployment() {
    local selector=$(kubectl get service moshimoshi-service -n $NAMESPACE -o jsonpath='{.spec.selector.version}')
    echo $selector
}

# Get inactive deployment
get_inactive_deployment() {
    local active=$(get_active_deployment)
    if [ "$active" == "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Deploy new version
deploy_new_version() {
    local target=$1
    local version=$2
    
    log_info "Deploying version $version to $target environment..."
    
    # Update deployment with new image
    kubectl set image deployment/moshimoshi-$target \
        moshimoshi=$DOCKER_REGISTRY/moshimoshi:$version \
        -n $NAMESPACE \
        --record
    
    # Wait for rollout to complete
    if kubectl rollout status deployment/moshimoshi-$target \
        -n $NAMESPACE \
        --timeout=${DEPLOYMENT_TIMEOUT}s; then
        log_success "Deployment rollout completed successfully."
        return 0
    else
        log_error "Deployment rollout failed or timed out."
        return 1
    fi
}

# Health check function
perform_health_check() {
    local target=$1
    local retries=$HEALTH_CHECK_RETRIES
    
    log_info "Performing health checks on $target deployment..."
    
    while [ $retries -gt 0 ]; do
        # Check pod readiness
        local ready_pods=$(kubectl get deployment moshimoshi-$target -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
        local desired_pods=$(kubectl get deployment moshimoshi-$target -n $NAMESPACE -o jsonpath='{.spec.replicas}')
        
        if [ "$ready_pods" == "$desired_pods" ] && [ "$ready_pods" -gt 0 ]; then
            log_info "All pods are ready ($ready_pods/$desired_pods)."
            
            # Check application health endpoint
            local pod_name=$(kubectl get pods -n $NAMESPACE -l app=moshimoshi,version=$target -o jsonpath='{.items[0].metadata.name}')
            
            if kubectl exec $pod_name -n $NAMESPACE -- wget -q -O- http://localhost:3000/api/health > /dev/null 2>&1; then
                local health_status=$(kubectl exec $pod_name -n $NAMESPACE -- wget -q -O- http://localhost:3000/api/health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
                
                if [ "$health_status" == "healthy" ]; then
                    log_success "Application health check passed."
                    return 0
                else
                    log_warning "Application health status: $health_status"
                fi
            fi
        fi
        
        retries=$((retries - 1))
        log_info "Health check attempt failed. Retries remaining: $retries"
        sleep $HEALTH_CHECK_INTERVAL
    done
    
    log_error "Health checks failed after $HEALTH_CHECK_RETRIES attempts."
    return 1
}

# Monitor metrics for anomalies
monitor_metrics() {
    local target=$1
    local duration=60
    
    log_info "Monitoring metrics for $duration seconds..."
    
    # Get baseline metrics from current deployment
    local baseline_error_rate=$(kubectl exec -n $NAMESPACE \
        $(kubectl get pods -n $NAMESPACE -l app=moshimoshi,version=$(get_active_deployment) -o jsonpath='{.items[0].metadata.name}') \
        -- wget -q -O- http://localhost:3000/api/health/metrics | grep -o '"error_rate":[0-9.]*' | cut -d: -f2)
    
    sleep $duration
    
    # Get new deployment metrics
    local new_error_rate=$(kubectl exec -n $NAMESPACE \
        $(kubectl get pods -n $NAMESPACE -l app=moshimoshi,version=$target -o jsonpath='{.items[0].metadata.name}') \
        -- wget -q -O- http://localhost:3000/api/health/metrics | grep -o '"error_rate":[0-9.]*' | cut -d: -f2)
    
    # Compare error rates (allow 10% increase)
    if (( $(echo "$new_error_rate > $baseline_error_rate * 1.1" | bc -l) )); then
        log_error "Error rate increased significantly (baseline: $baseline_error_rate, new: $new_error_rate)"
        return 1
    fi
    
    log_success "Metrics monitoring passed."
    return 0
}

# Switch traffic to new deployment
switch_traffic() {
    local target=$1
    
    log_info "Switching production traffic to $target deployment..."
    
    # Update service selector
    kubectl patch service moshimoshi-service -n $NAMESPACE \
        -p '{"spec":{"selector":{"version":"'$target'"}}}'
    
    log_success "Traffic switched to $target deployment."
}

# Rollback function
rollback_deployment() {
    local original=$1
    
    log_error "Initiating rollback to $original deployment..."
    
    # Switch traffic back
    switch_traffic $original
    
    # Scale down failed deployment
    kubectl scale deployment moshimoshi-$(get_inactive_deployment) \
        -n $NAMESPACE \
        --replicas=0
    
    log_warning "Rollback completed. Failed deployment scaled down."
    
    # Send alert
    send_alert "Deployment failed and rolled back to $original"
}

# Send alert function
send_alert() {
    local message=$1
    
    # Send to monitoring system
    if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST $SLACK_WEBHOOK_URL \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"🚨 Deployment Alert: $message\"}"
    fi
    
    # Log to Sentry
    if [ ! -z "$SENTRY_DSN" ]; then
        curl -X POST "https://sentry.io/api/events/" \
            -H "X-Sentry-Auth: Sentry sentry_key=$SENTRY_DSN" \
            -d "{\"message\":\"$message\",\"level\":\"error\"}"
    fi
}

# Main deployment function
main() {
    local VERSION=$1
    
    if [ -z "$VERSION" ]; then
        log_error "Usage: $0 <version>"
        exit 1
    fi
    
    log_info "Starting blue-green deployment for version $VERSION"
    
    # Check prerequisites
    check_prerequisites
    
    # Get current deployments
    ACTIVE=$(get_active_deployment)
    INACTIVE=$(get_inactive_deployment)
    
    log_info "Current active deployment: $ACTIVE"
    log_info "Target deployment: $INACTIVE"
    
    # Deploy to inactive environment
    if ! deploy_new_version $INACTIVE $VERSION; then
        log_error "Deployment failed."
        exit 1
    fi
    
    # Perform health checks
    if ! perform_health_check $INACTIVE; then
        if [ "$ROLLBACK_ON_FAILURE" == "true" ]; then
            rollback_deployment $ACTIVE
        fi
        exit 1
    fi
    
    # Monitor metrics before switching
    if ! monitor_metrics $INACTIVE; then
        if [ "$ROLLBACK_ON_FAILURE" == "true" ]; then
            rollback_deployment $ACTIVE
        fi
        exit 1
    fi
    
    # Switch traffic
    switch_traffic $INACTIVE
    
    # Post-switch monitoring
    log_info "Monitoring production traffic for 2 minutes..."
    sleep 120
    
    if ! perform_health_check $INACTIVE; then
        log_error "Post-switch health check failed."
        if [ "$ROLLBACK_ON_FAILURE" == "true" ]; then
            rollback_deployment $ACTIVE
            exit 1
        fi
    fi
    
    # Scale down old deployment (keep 1 replica for quick rollback)
    log_info "Scaling down old deployment..."
    kubectl scale deployment moshimoshi-$ACTIVE \
        -n $NAMESPACE \
        --replicas=1
    
    log_success "Deployment completed successfully!"
    log_success "Version $VERSION is now live on $INACTIVE environment."
    
    # Send success notification
    send_alert "Successfully deployed version $VERSION to production"
}

# Run main function
main "$@"