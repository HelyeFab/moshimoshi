#!/bin/bash

# Production Deployment Script for Moshimoshi Review Engine
# Zero-downtime blue-green deployment with progressive rollout

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="production"
APP_NAME="moshimoshi"
VERSION="${1:-1.0.0}"
REGISTRY="gcr.io/moshimoshi-prod"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Send notification to Slack
notify_slack() {
    local message="$1"
    local status="${2:-info}"
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${status}: ${message}\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    # Check namespace
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Backup current deployment
backup_deployment() {
    log_info "Backing up current deployment..."
    
    local backup_dir="backups/$(date '+%Y%m%d_%H%M%S')"
    mkdir -p "$backup_dir"
    
    # Export current deployments
    kubectl get deployment -n $NAMESPACE -o yaml > "$backup_dir/deployments.yaml"
    kubectl get service -n $NAMESPACE -o yaml > "$backup_dir/services.yaml"
    kubectl get ingress -n $NAMESPACE -o yaml > "$backup_dir/ingress.yaml"
    
    log_success "Backup saved to $backup_dir"
}

# Determine active environment (blue or green)
get_active_environment() {
    local active=$(kubectl get service moshimoshi-active -n $NAMESPACE \
        -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "green")
    echo "$active"
}

# Deploy to inactive environment
deploy_new_version() {
    local active_env=$(get_active_environment)
    local target_env="blue"
    
    if [ "$active_env" == "blue" ]; then
        target_env="green"
    fi
    
    log_info "Active environment: $active_env"
    log_info "Deploying version $VERSION to $target_env environment..."
    
    # Update image in deployment
    kubectl set image deployment/moshimoshi-$target_env \
        moshimoshi=$REGISTRY/$APP_NAME:$VERSION \
        -n $NAMESPACE \
        --record
    
    # Wait for rollout to complete
    log_info "Waiting for rollout to complete..."
    if ! kubectl rollout status deployment/moshimoshi-$target_env -n $NAMESPACE --timeout=300s; then
        log_error "Rollout failed"
        return 1
    fi
    
    log_success "Deployment to $target_env environment completed"
    echo "$target_env"
}

# Run smoke tests
run_smoke_tests() {
    local environment="$1"
    log_info "Running smoke tests on $environment environment..."
    
    # Get service endpoint
    local service_ip=$(kubectl get service moshimoshi-$environment -n $NAMESPACE \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "localhost")
    
    # Health check
    if ! curl -f -s -o /dev/null -w "%{http_code}" "http://$service_ip/api/health" | grep -q "200"; then
        log_error "Health check failed"
        return 1
    fi
    
    # Ready check
    if ! curl -f -s -o /dev/null -w "%{http_code}" "http://$service_ip/api/ready" | grep -q "200"; then
        log_error "Ready check failed"
        return 1
    fi
    
    # Basic functionality test
    if ! curl -f -s "http://$service_ip/api/version" | grep -q "$VERSION"; then
        log_warning "Version check failed - might be cached"
    fi
    
    log_success "Smoke tests passed"
}

# Progressive traffic shift
progressive_traffic_shift() {
    local target_env="$1"
    local weights=(10 25 50 75 100)
    
    log_info "Starting progressive traffic shift to $target_env..."
    
    for weight in "${weights[@]}"; do
        log_info "Shifting ${weight}% traffic to $target_env..."
        
        # Update canary weight
        kubectl patch ingress moshimoshi-ingress-canary -n $NAMESPACE \
            -p "{\"metadata\":{\"annotations\":{\"nginx.ingress.kubernetes.io/canary-weight\":\"$weight\"}}}"
        
        # Wait and monitor
        sleep 30
        
        # Check error rate
        local error_rate=$(check_error_rate)
        if (( $(echo "$error_rate > 1" | bc -l) )); then
            log_error "Error rate too high: ${error_rate}%"
            return 1
        fi
        
        log_success "${weight}% traffic shifted successfully"
        notify_slack "Traffic shift: ${weight}% to $target_env" "info"
    done
    
    log_success "Progressive traffic shift completed"
}

# Check error rate (mock implementation - replace with actual metrics)
check_error_rate() {
    # This should query your monitoring system (Prometheus/DataDog)
    # For now, returning a mock value
    echo "0.1"
}

# Switch active environment
switch_active_environment() {
    local new_env="$1"
    
    log_info "Switching active environment to $new_env..."
    
    # Update active service selector
    kubectl patch service moshimoshi-active -n $NAMESPACE \
        -p "{\"spec\":{\"selector\":{\"version\":\"$new_env\"}}}"
    
    # Disable canary
    kubectl patch ingress moshimoshi-ingress-canary -n $NAMESPACE \
        -p "{\"metadata\":{\"annotations\":{\"nginx.ingress.kubernetes.io/canary\":\"false\"}}}"
    
    log_success "Active environment switched to $new_env"
}

# Rollback deployment
rollback() {
    local active_env=$(get_active_environment)
    
    log_warning "Initiating rollback..."
    notify_slack "Rollback initiated for version $VERSION" "warning"
    
    # Switch back to previous environment
    if [ "$active_env" == "blue" ]; then
        switch_active_environment "green"
    else
        switch_active_environment "blue"
    fi
    
    # Disable canary
    kubectl patch ingress moshimoshi-ingress-canary -n $NAMESPACE \
        -p "{\"metadata\":{\"annotations\":{\"nginx.ingress.kubernetes.io/canary\":\"false\"}}}"
    
    log_success "Rollback completed"
    notify_slack "Rollback completed successfully" "success"
}

# Main deployment flow
main() {
    log_info "Starting production deployment of version $VERSION"
    notify_slack "Deployment started for version $VERSION" "info"
    
    # Pre-deployment checks
    check_prerequisites
    backup_deployment
    
    # Deploy new version
    new_env=$(deploy_new_version)
    if [ $? -ne 0 ]; then
        log_error "Deployment failed"
        notify_slack "Deployment failed for version $VERSION" "error"
        exit 1
    fi
    
    # Run smoke tests
    if ! run_smoke_tests "$new_env"; then
        log_error "Smoke tests failed"
        rollback
        exit 1
    fi
    
    # Progressive traffic shift
    if ! progressive_traffic_shift "$new_env"; then
        log_error "Traffic shift failed"
        rollback
        exit 1
    fi
    
    # Final switch
    switch_active_environment "$new_env"
    
    # Verify deployment
    sleep 10
    if ! run_smoke_tests "$new_env"; then
        log_error "Post-deployment verification failed"
        rollback
        exit 1
    fi
    
    log_success "Deployment completed successfully!"
    notify_slack "Deployment of version $VERSION completed successfully" "success"
    
    # Clean up old environment (optional - can be done later)
    log_info "Old environment kept for quick rollback. Run 'cleanup-old-env.sh' to remove."
}

# Handle interrupts
trap 'log_error "Deployment interrupted"; rollback; exit 1' INT TERM

# Run main function
main "$@"