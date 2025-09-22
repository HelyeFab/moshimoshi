# Deployment Runbook - Moshimoshi v1.0.0

## Pre-Deployment Checklist

### Environment Verification
- [ ] Production environment configured
- [ ] Database migrations tested in staging
- [ ] SSL certificates valid and installed
- [ ] DNS records configured
- [ ] CDN configured (if applicable)
- [ ] Monitoring tools connected
- [ ] Backup systems verified

### Code Preparation
- [ ] All tests passing (`npm run test:e2e`)
- [ ] Security scan clean (`./scripts/secret-scan.sh`)
- [ ] Build successful (`npm run build`)
- [ ] Docker image built and tagged
- [ ] Environment variables configured
- [ ] Secrets management configured

### Team Readiness
- [ ] Deployment team briefed
- [ ] Support team on standby
- [ ] Communication channels open
- [ ] Rollback plan reviewed

## Deployment Steps

### Step 1: Pre-Deployment Backup
```bash
# Backup current production database
pg_dump $PROD_DB_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup current application state
kubectl create backup prod-backup-$(date +%Y%m%d)

# Verify backups
./scripts/verify-backup.sh
```

### Step 2: Build and Push Docker Image
```bash
# Build production image
docker build -t moshimoshi:v1.0.0 -f Dockerfile.prod .

# Tag for registry
docker tag moshimoshi:v1.0.0 $REGISTRY/moshimoshi:v1.0.0
docker tag moshimoshi:v1.0.0 $REGISTRY/moshimoshi:latest

# Push to registry
docker push $REGISTRY/moshimoshi:v1.0.0
docker push $REGISTRY/moshimoshi:latest

# Verify image
docker run --rm $REGISTRY/moshimoshi:v1.0.0 npm run health-check
```

### Step 3: Database Migrations
```bash
# Run migrations in transaction
npm run migrate:prod -- --dry-run  # Verify first
npm run migrate:prod

# Verify migrations
npm run db:verify
```

### Step 4: Deploy to Kubernetes

#### Blue-Green Deployment
```bash
# Deploy to green environment
kubectl apply -f k8s/deployment-green.yaml

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=moshimoshi,version=green --timeout=300s

# Run smoke tests
npm run test:smoke -- --env=green

# Switch traffic to green
kubectl apply -f k8s/service-green.yaml

# Monitor for 5 minutes
./scripts/monitor-deployment.sh --duration=5m

# If stable, update blue environment
kubectl apply -f k8s/deployment-blue.yaml
```

#### Alternative: Rolling Update
```bash
# Update deployment
kubectl set image deployment/moshimoshi \
  moshimoshi=$REGISTRY/moshimoshi:v1.0.0 \
  --record

# Monitor rollout
kubectl rollout status deployment/moshimoshi

# Verify pods
kubectl get pods -l app=moshimoshi
```

### Step 5: Post-Deployment Verification

#### Health Checks
```bash
# Application health
curl https://api.moshimoshi.app/health
# Expected: {"status":"healthy","version":"1.0.0"}

# Database connectivity
curl https://api.moshimoshi.app/health/db
# Expected: {"database":"connected","latency":"<100ms"}

# Redis connectivity  
curl https://api.moshimoshi.app/health/cache
# Expected: {"cache":"connected","latency":"<10ms"}
```

#### Functional Tests
```bash
# Run E2E tests against production
npm run test:e2e:prod -- --grep "critical"

# Verify key user journeys
npm run test:smoke:prod
```

#### Performance Verification
```bash
# Load test
npm run test:load -- --users=100 --duration=5m

# Check metrics
curl https://api.moshimoshi.app/metrics
```

### Step 6: Monitor and Observe

#### Real-time Monitoring
```bash
# Watch logs
kubectl logs -f deployment/moshimoshi

# Monitor metrics
watch -n 5 'kubectl top pods -l app=moshimoshi'

# Check error rates in Sentry
open https://sentry.io/organizations/moshimoshi/issues/
```

#### Alerts to Watch
- Error rate > 1%
- Response time > 500ms (p95)
- Memory usage > 80%
- CPU usage > 70%
- Failed health checks

## Environment Variables

### Required Production Variables
```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_SIZE=20

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://moshimoshi.app
JWT_SECRET=... # Min 32 characters
```

## Rollback Procedures

See [Rollback Procedures](./rollback-procedures.md) for detailed steps.

### Quick Rollback
```bash
# Immediate rollback to previous version
kubectl rollout undo deployment/moshimoshi

# Or switch back to blue in blue-green
kubectl apply -f k8s/service-blue.yaml
```

## Troubleshooting

### Common Issues

#### Pods Not Starting
```bash
# Check pod status
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name> --previous

# Common fixes:
# - Verify image pull secrets
# - Check resource limits
# - Verify environment variables
```

#### Database Connection Issues
```bash
# Test connection
kubectl exec -it <pod-name> -- npm run db:test

# Check connection pool
kubectl exec -it <pod-name> -- npm run db:pool:status

# Verify firewall rules
```

#### High Memory Usage
```bash
# Check memory usage
kubectl top pods

# Restart pods with memory issues
kubectl delete pod <pod-name>

# Scale horizontally if needed
kubectl scale deployment/moshimoshi --replicas=5
```

## Post-Deployment Tasks

### Within 1 Hour
- [ ] Monitor error rates
- [ ] Check user feedback channels
- [ ] Verify backup systems
- [ ] Update status page

### Within 24 Hours
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Document any issues
- [ ] Plan optimization tasks

### Within 1 Week
- [ ] Conduct retrospective
- [ ] Update documentation
- [ ] Plan next release
- [ ] Archive deployment artifacts

## Communication Plan

### Status Updates
- **Slack Channel**: #deployments
- **Status Page**: https://status.moshimoshi.app
- **Email List**: ops@moshimoshi.app

### Escalation Path
1. On-call Engineer
2. Team Lead
3. CTO
4. CEO (critical issues only)

## Success Criteria

Deployment is considered successful when:
- [ ] All health checks passing
- [ ] Error rate < 0.1%
- [ ] Response time < 200ms (p95)
- [ ] No critical alerts for 30 minutes
- [ ] Smoke tests passing
- [ ] User reports positive

## Appendix

### Useful Commands
```bash
# Get deployment status
kubectl get deployment moshimoshi -o wide

# Scale deployment
kubectl scale deployment/moshimoshi --replicas=10

# Port forward for debugging
kubectl port-forward deployment/moshimoshi 3000:3000

# Execute commands in pod
kubectl exec -it deployment/moshimoshi -- /bin/sh

# Get recent events
kubectl get events --sort-by='.lastTimestamp'
```

### Emergency Contacts
- On-call: [Phone Number]
- Team Lead: [Phone Number]
- Database Admin: [Phone Number]
- Security Team: [Phone Number]

---

**Document Version:** 1.0.0  
**Last Updated:** [Date]  
**Next Review:** [Date + 3 months]