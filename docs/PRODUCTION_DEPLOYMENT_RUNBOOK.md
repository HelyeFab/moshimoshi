# Production Deployment Runbook

## Deployment Commander: Agent 1
**Version**: 1.0.0  
**Date**: Week 3 - Thursday  
**Deployment Window**: 08:00 - 12:00 UTC

---

## Pre-Deployment Checklist

### Wednesday Evening (Day Before)
- [ ] All staging tests passed
- [ ] Database backup completed
- [ ] Security scan clean
- [ ] DNS pre-configured
- [ ] SSL certificates valid
- [ ] Feature flags configured
- [ ] Rollback procedure tested
- [ ] Team briefing completed
- [ ] Communication plan activated
- [ ] Monitoring dashboards ready

### Thursday Morning (Deployment Day)
- [ ] War room opened (06:00)
- [ ] All agents present
- [ ] Communication channels verified
- [ ] Production backup created (07:00)
- [ ] Final go/no-go decision (07:30)

---

## Deployment Procedure

### Phase 1: Initial Deployment (08:00 - 09:00)

#### Step 1.1: Deploy to Blue Environment
```bash
# Deploy new version to blue environment
./scripts/deploy-production.sh 1.0.0

# Expected output:
# - Docker image pushed
# - Blue deployment updated
# - Pods healthy (3/3 ready)
```

#### Step 1.2: Smoke Tests
```bash
# Run smoke tests on blue environment
./scripts/test-production-blue.sh

# Success criteria:
# - Health check: 200 OK
# - Ready check: 200 OK
# - Version check: 1.0.0
# - Database connectivity: OK
# - Redis connectivity: OK
```

### Phase 2: Progressive Traffic Shift (09:00 - 10:30)

#### Step 2.1: 10% Traffic (09:00 - 09:30)
```bash
kubectl patch ingress moshimoshi-ingress-canary -n production \
  -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"10"}}}'
```

**Monitor**:
- Error rate < 0.5%
- P95 latency < 200ms
- No critical alerts

**Decision Point**: Continue or rollback?

#### Step 2.2: 50% Traffic (09:30 - 10:00)
```bash
kubectl patch ingress moshimoshi-ingress-canary -n production \
  -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"50"}}}'
```

**Monitor**:
- Error rate < 0.5%
- P95 latency < 200ms
- CPU usage < 70%
- Memory usage < 80%

**Decision Point**: Continue or rollback?

#### Step 2.3: 100% Traffic (10:00 - 10:30)
```bash
kubectl patch ingress moshimoshi-ingress-canary -n production \
  -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"100"}}}'
```

**Monitor**:
- All metrics stable
- No user complaints
- No critical errors

### Phase 3: Final Switch (10:30 - 11:00)

#### Step 3.1: Switch Active Service
```bash
# Switch active service to blue
kubectl patch service moshimoshi-active -n production \
  -p '{"spec":{"selector":{"version":"blue"}}}'

# Disable canary
kubectl patch ingress moshimoshi-ingress-canary -n production \
  -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary":"false"}}}'
```

#### Step 3.2: Clear Caches
```bash
# Clear CDN cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Clear Redis cache (optional)
kubectl exec -n production deployment/redis -- redis-cli FLUSHALL
```

### Phase 4: Validation (11:00 - 12:00)

#### Step 4.1: Full System Validation
```bash
# Run comprehensive tests
./scripts/validate-production.sh

# Check all services
kubectl get pods -n production
kubectl get services -n production
kubectl get ingress -n production
```

#### Step 4.2: User Acceptance
- Check user feedback channels
- Monitor support tickets
- Review social media
- Check application logs

---

## Rollback Procedure

### Immediate Rollback Triggers
- Error rate > 5%
- P95 latency > 1000ms
- Database corruption detected
- Security breach identified
- Critical functionality broken

### Rollback Steps (< 5 minutes)
```bash
# Execute emergency rollback
./scripts/rollback-production.sh "Reason for rollback"

# This script will:
# 1. Switch traffic to green (30s)
# 2. Verify green health (30s)
# 3. Rollback database if needed (2m)
# 4. Clear all caches (30s)
# 5. Validate rollback (30s)
```

### Post-Rollback Actions
1. Notify all stakeholders
2. Create incident report
3. Schedule post-mortem
4. Plan remediation

---

## Monitoring & Alerts

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Error Rate | < 0.1% | 0.1-1% | > 1% |
| P95 Latency | < 100ms | 100-500ms | > 500ms |
| CPU Usage | < 50% | 50-70% | > 70% |
| Memory Usage | < 60% | 60-80% | > 80% |
| Pod Restarts | 0 | 1-2 | > 2 |
| 5xx Errors | < 0.01% | 0.01-0.1% | > 0.1% |

### Dashboard Links
- **Kubernetes**: https://dashboard.k8s.moshimoshi.app
- **Grafana**: https://grafana.moshimoshi.app
- **DataDog**: https://app.datadoghq.com/dashboard/moshimoshi
- **Sentry**: https://sentry.io/organizations/moshimoshi
- **Status Page**: https://status.moshimoshi.app

### Alert Escalation
1. **Level 1** (0-5 min): On-call engineer
2. **Level 2** (5-15 min): Deployment commander
3. **Level 3** (15-30 min): Engineering manager
4. **Level 4** (30+ min): CTO/Executive team

---

## Communication Plan

### Stakeholder Updates

#### Pre-Deployment (Wednesday)
```
Subject: Production Deployment Scheduled - Moshimoshi v1.0.0
Time: Tomorrow 08:00-12:00 UTC
Impact: No expected downtime
Action: No action required
```

#### During Deployment
- **08:00**: Deployment started
- **09:00**: 10% traffic shifted
- **09:30**: 50% traffic shifted
- **10:00**: 100% traffic shifted
- **10:30**: Full production switch
- **11:00**: Validation in progress
- **12:00**: Deployment complete

#### Post-Deployment
```
Subject: Production Deployment Complete - Moshimoshi v1.0.0
Status: Successfully deployed
Performance: All metrics normal
Next Steps: Monitoring continues
```

### Communication Channels
- **Slack**: #deployment-war-room
- **Email**: deployment@moshimoshi.app
- **Phone**: Deployment hotline
- **Status Page**: https://status.moshimoshi.app

---

## Post-Deployment Tasks

### Immediate (Day 1)
- [ ] Remove canary configuration
- [ ] Update documentation
- [ ] Close deployment tickets
- [ ] Send success announcement

### Short-term (Days 2-3)
- [ ] Monitor metrics trends
- [ ] Review user feedback
- [ ] Performance tuning
- [ ] Clean up old green environment

### Long-term (Week 2)
- [ ] Conduct retrospective
- [ ] Update runbook with lessons learned
- [ ] Plan next deployment
- [ ] Archive deployment artifacts

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Deployment Commander | Agent 1 | +1-XXX-XXX-XXXX | agent1@moshimoshi.app |
| SRE Lead | Agent 2 | +1-XXX-XXX-XXXX | agent2@moshimoshi.app |
| Database Admin | Agent 3 | +1-XXX-XXX-XXXX | agent3@moshimoshi.app |
| Security Officer | Agent 4 | +1-XXX-XXX-XXXX | agent4@moshimoshi.app |
| Support Lead | Agent 5 | +1-XXX-XXX-XXXX | agent5@moshimoshi.app |

---

## Appendix

### A. Environment Variables
```bash
export NAMESPACE=production
export REGISTRY=gcr.io/moshimoshi-prod
export VERSION=1.0.0
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ZONE_ID=...
```

### B. Useful Commands
```bash
# View pods
kubectl get pods -n production -w

# View logs
kubectl logs -n production -l app=moshimoshi --tail=100 -f

# Describe deployment
kubectl describe deployment moshimoshi-blue -n production

# Port forward for debugging
kubectl port-forward -n production deployment/moshimoshi-blue 3000:3000

# Execute into pod
kubectl exec -it -n production deployment/moshimoshi-blue -- /bin/sh
```

### C. Troubleshooting Guide

#### High Error Rate
1. Check application logs
2. Verify database connectivity
3. Check external service dependencies
4. Review recent code changes

#### High Latency
1. Check pod resource usage
2. Verify database query performance
3. Check cache hit rates
4. Review network latency

#### Pod Crashes
1. Check pod logs
2. Review resource limits
3. Check for memory leaks
4. Verify environment variables

---

**Document Version**: 1.0  
**Last Updated**: Week 3, Monday  
**Next Review**: Post-deployment retrospective