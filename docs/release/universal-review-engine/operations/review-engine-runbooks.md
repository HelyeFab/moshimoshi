# Review Engine Production Runbooks

## Table of Contents
1. [System Overview](#system-overview)
2. [Deployment Procedures](#deployment-procedures)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Incident Response](#incident-response)
5. [Common Issues & Solutions](#common-issues--solutions)
6. [Rollback Procedures](#rollback-procedures)
7. [Maintenance Procedures](#maintenance-procedures)
8. [Disaster Recovery](#disaster-recovery)

---

## System Overview

### Architecture Components
- **Frontend**: Next.js 14 App Router
- **API Layer**: Next.js API Routes
- **Database**: Firebase Firestore
- **Cache**: Redis/Upstash
- **Offline Storage**: IndexedDB
- **CDN**: CloudFlare
- **Monitoring**: Sentry, Datadog

### Critical Services
| Service | Purpose | SLA | Owner |
|---------|---------|-----|-------|
| Review API | Core review functionality | 99.9% | Backend Team |
| SRS Engine | Spaced repetition calculations | 99.95% | Algorithm Team |
| Session Manager | Review session state | 99.9% | Backend Team |
| Queue Generator | Review queue creation | 99.9% | Backend Team |
| Pin Manager | Content pinning | 99.5% | Feature Team |

---

## Deployment Procedures

### Pre-Deployment Checklist
```bash
# 1. Run all tests
npm run test:all
npm run test:integration
npm run test:e2e

# 2. Check test coverage
npm run coverage
# Ensure coverage > 80%

# 3. Security scan
npm audit
npm run security:scan

# 4. Build verification
npm run build
npm run build:analyze

# 5. Performance check
npm run lighthouse
# Ensure score > 90

# 6. Database migrations
npm run migrate:dry-run
```

### Deployment Steps

#### Blue-Green Deployment
```bash
# 1. Deploy to green environment
./scripts/deploy.sh green

# 2. Run smoke tests
npm run test:smoke -- --env=green

# 3. Gradual traffic shift
./scripts/traffic-shift.sh 10  # 10% to green
# Monitor for 10 minutes
./scripts/traffic-shift.sh 50  # 50% to green
# Monitor for 10 minutes
./scripts/traffic-shift.sh 100 # 100% to green

# 4. Verify deployment
./scripts/verify-deployment.sh

# 5. Update blue environment
./scripts/deploy.sh blue
```

### Post-Deployment Verification
```bash
# 1. Health checks
curl https://api.moshimoshi.app/health
curl https://api.moshimoshi.app/api/review/health

# 2. Critical path testing
npm run test:critical-path

# 3. Monitor error rates
datadog-cli metrics query "error_rate{service:review-engine}" --last 1h

# 4. Check cache hit rates
redis-cli INFO stats | grep hit_rate

# 5. Verify offline sync
npm run test:offline-sync
```

---

## Monitoring & Alerts

### Key Metrics

#### Application Metrics
```yaml
review_queue_generation_time:
  threshold: 200ms
  alert: P2
  
srs_calculation_time:
  threshold: 10ms
  alert: P1
  
session_creation_failure_rate:
  threshold: 1%
  alert: P1
  
api_response_time_p95:
  threshold: 500ms
  alert: P2
  
cache_hit_rate:
  threshold: < 90%
  alert: P3
```

#### Business Metrics
```yaml
daily_active_users:
  threshold: < 80% of average
  alert: P2
  
review_completion_rate:
  threshold: < 70%
  alert: P3
  
sync_failure_rate:
  threshold: > 5%
  alert: P2
```

### Alert Response Matrix
| Priority | Response Time | Escalation | Example |
|----------|--------------|------------|---------|
| P1 | 15 minutes | On-call → Lead → Manager | Service down |
| P2 | 1 hour | On-call → Lead | Performance degradation |
| P3 | 4 hours | On-call | Non-critical issue |
| P4 | Next business day | Team | Minor bug |

---

## Incident Response

### Incident Classification

#### Severity Levels
- **SEV1**: Complete service outage
- **SEV2**: Major functionality broken
- **SEV3**: Minor functionality affected
- **SEV4**: Cosmetic issues

### Response Playbooks

#### Playbook: API Service Down
```bash
# 1. Verify the issue
curl -I https://api.moshimoshi.app/health

# 2. Check logs
tail -f /var/log/review-engine/error.log
datadog-cli logs query "service:review-engine status:error" --last 1h

# 3. Check database connectivity
firebase-admin test-connection

# 4. Check Redis connectivity
redis-cli ping

# 5. Restart service if needed
systemctl restart review-engine

# 6. If persists, rollback
./scripts/rollback.sh previous

# 7. Create incident report
./scripts/create-incident.sh SEV1 "API Service Down"
```

#### Playbook: High Error Rate
```bash
# 1. Identify error pattern
datadog-cli logs query "service:review-engine status:error" --last 1h | head -100

# 2. Check recent deployments
git log --oneline -10
kubectl rollout history deployment/review-engine

# 3. Check database performance
firebase-admin performance-stats

# 4. Check memory/CPU
kubectl top pods -l app=review-engine

# 5. Scale if needed
kubectl scale deployment review-engine --replicas=10

# 6. Enable emergency cache
redis-cli SET emergency_cache_enabled true EX 3600
```

#### Playbook: Database Performance Issues
```bash
# 1. Check slow queries
firebase-admin slow-queries --last 1h

# 2. Check index usage
firebase-admin index-stats

# 3. Enable read replicas
firebase-admin enable-replicas --count 3

# 4. Increase cache TTL
redis-cli CONFIG SET review_cache_ttl 3600

# 5. Notify users
./scripts/status-page.sh update "Experiencing slow performance. Team investigating."
```

---

## Common Issues & Solutions

### Issue: Queue Generation Timeout
**Symptoms**: Users see "Loading queue..." indefinitely
**Solution**:
```bash
# 1. Clear queue cache
redis-cli DEL "queue:*"

# 2. Restart queue service
systemctl restart queue-generator

# 3. Reduce batch size
firebase-admin set-config queue_batch_size 50
```

### Issue: Session State Lost
**Symptoms**: Users lose progress mid-session
**Solution**:
```bash
# 1. Check IndexedDB quota
./scripts/check-indexeddb-quota.sh

# 2. Verify session persistence
firebase-admin verify-sessions --last 1h

# 3. Enable session recovery
firebase-admin set-config enable_session_recovery true
```

### Issue: Sync Conflicts
**Symptoms**: Data inconsistency between devices
**Solution**:
```bash
# 1. Check sync queue
redis-cli LLEN sync_queue

# 2. Process stuck items
./scripts/process-sync-queue.sh

# 3. Reset user sync state
firebase-admin reset-sync --user <userId>
```

### Issue: SRS Calculations Wrong
**Symptoms**: Incorrect review intervals
**Solution**:
```bash
# 1. Verify algorithm version
cat /app/lib/review-engine/srs/version.txt

# 2. Recalculate affected items
./scripts/recalculate-srs.sh --from "2024-01-01"

# 3. Clear SRS cache
redis-cli DEL "srs:*"
```

---

## Rollback Procedures

### Automatic Rollback Triggers
- Error rate > 5%
- Response time P95 > 1s
- Health check failures > 3

### Manual Rollback
```bash
# 1. Identify target version
kubectl rollout history deployment/review-engine

# 2. Rollback to previous
kubectl rollout undo deployment/review-engine

# OR rollback to specific version
kubectl rollout undo deployment/review-engine --to-revision=42

# 3. Verify rollback
kubectl rollout status deployment/review-engine

# 4. Clear caches
redis-cli FLUSHDB

# 5. Notify team
./scripts/notify-team.sh "Rollback completed to version X"
```

### Database Rollback
```bash
# 1. Stop writes
firebase-admin maintenance-mode enable

# 2. Create backup
firebase-admin backup create pre-rollback

# 3. Restore previous backup
firebase-admin backup restore <backup-id>

# 4. Verify data integrity
firebase-admin verify-integrity

# 5. Re-enable writes
firebase-admin maintenance-mode disable
```

---

## Maintenance Procedures

### Daily Maintenance
```bash
# Run at 3 AM UTC
0 3 * * * /opt/maintenance/daily.sh

# daily.sh contents:
#!/bin/bash
# 1. Clear expired sessions
firebase-admin cleanup-sessions --older-than 24h

# 2. Optimize cache
redis-cli --scan --pattern "expired:*" | xargs redis-cli DEL

# 3. Backup critical data
firebase-admin backup create daily-$(date +%Y%m%d)

# 4. Update statistics
./scripts/update-stats.sh
```

### Weekly Maintenance
```bash
# Run Sunday 2 AM UTC
0 2 * * 0 /opt/maintenance/weekly.sh

# weekly.sh contents:
#!/bin/bash
# 1. Database optimization
firebase-admin optimize-indexes

# 2. Clear old logs
find /var/log/review-engine -mtime +7 -delete

# 3. Security updates
npm audit fix

# 4. Performance analysis
./scripts/performance-report.sh --email team@moshimoshi.app
```

### Monthly Maintenance
```bash
# First Sunday of month
0 2 1-7 * 0 /opt/maintenance/monthly.sh

# monthly.sh contents:
#!/bin/bash
# 1. Full backup
firebase-admin backup create monthly-$(date +%Y%m)

# 2. Dependency updates
npm update
npm audit

# 3. Certificate renewal check
certbot renew --dry-run

# 4. Capacity planning
./scripts/capacity-report.sh
```

---

## Disaster Recovery

### RTO/RPO Targets
- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 1 hour

### Backup Strategy
```yaml
Continuous:
  - Database replication to secondary region
  - Redis snapshots every hour
  
Daily:
  - Full database backup
  - Configuration backup
  - Code repository backup
  
Weekly:
  - Full system image
  - Encrypted offsite backup
```

### Recovery Procedures

#### Complete System Failure
```bash
# 1. Activate DR site
./scripts/dr-activate.sh us-west-2

# 2. Update DNS
cloudflare-cli dns update api.moshimoshi.app --target dr.moshimoshi.app

# 3. Restore latest backup
firebase-admin restore --region us-west-2 --backup latest

# 4. Restore Redis
redis-cli --cluster restore backup.rdb

# 5. Verify services
./scripts/dr-verify.sh

# 6. Notify users
./scripts/status-page.sh update "Service restored. Some data loss possible."
```

#### Data Corruption
```bash
# 1. Identify corruption scope
firebase-admin verify-integrity --deep

# 2. Isolate affected data
firebase-admin quarantine --collection affected_items

# 3. Restore from backup
firebase-admin restore --partial --collection affected_items --timestamp "2024-01-01T00:00:00Z"

# 4. Rebuild derived data
./scripts/rebuild-srs.sh
./scripts/rebuild-stats.sh

# 5. Verify fix
firebase-admin verify-integrity --collection affected_items
```

---

## Emergency Contacts

### Escalation Chain
1. **On-Call Engineer**: PagerDuty
2. **Team Lead**: [Redacted]
3. **Engineering Manager**: [Redacted]
4. **VP Engineering**: [Redacted]

### External Services
- **Firebase Support**: [Support URL]
- **Redis Support**: [Support URL]
- **CloudFlare Support**: [Support URL]
- **Sentry Support**: [Support URL]

### Communication Channels
- **Incident Channel**: #incident-response
- **Status Page**: https://status.moshimoshi.app
- **Customer Support**: support@moshimoshi.app

---

## Appendix

### Useful Commands
```bash
# Get current version
kubectl get deployment review-engine -o jsonpath='{.spec.template.spec.containers[0].image}'

# Check pod health
kubectl get pods -l app=review-engine

# View recent logs
kubectl logs -l app=review-engine --tail=100

# Database stats
firebase-admin stats

# Cache stats
redis-cli INFO stats

# Active sessions
firebase-admin count-sessions --active

# Error rate
datadog-cli metrics query "sum:review.errors{*}.as_rate()" --last 1h
```

### Environment Variables
```bash
# Production
NEXT_PUBLIC_API_URL=https://api.moshimoshi.app
DATABASE_URL=firestore://project-id
REDIS_URL=redis://redis.moshimoshi.app:6379
SENTRY_DSN=https://xxx@sentry.io/xxx

# Staging
NEXT_PUBLIC_API_URL=https://staging-api.moshimoshi.app
DATABASE_URL=firestore://staging-project-id
REDIS_URL=redis://staging-redis.moshimoshi.app:6379
```

---

*Last Updated: 2025-09-10*
*Next Review: 2025-10-10*