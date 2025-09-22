# Rollback Procedures - Moshimoshi v1.0.0

## Overview

This document outlines the procedures for rolling back a deployment in case of critical issues. Time is critical during a rollback, so this document is organized for quick action.

## Quick Rollback Decision Tree

```
Is the issue critical? (Data loss, security breach, >50% errors)
├─ YES → Execute IMMEDIATE ROLLBACK
└─ NO → Is it affecting >10% of users?
    ├─ YES → Execute STANDARD ROLLBACK  
    └─ NO → Consider hotfix instead
```

## Immediate Rollback (< 5 minutes)

### For Kubernetes Deployment

```bash
# Option 1: Rollback to previous deployment
kubectl rollout undo deployment/moshimoshi

# Option 2: Blue-Green - Switch back to blue
kubectl apply -f k8s/service-blue.yaml

# Verify rollback
kubectl rollout status deployment/moshimoshi
kubectl get pods -l app=moshimoshi
```

### For Docker Deployment

```bash
# Stop current container
docker stop moshimoshi-prod

# Start previous version
docker run -d \
  --name moshimoshi-prod \
  --env-file .env.production \
  -p 3000:3000 \
  $REGISTRY/moshimoshi:v0.9.9  # Previous version

# Verify
docker logs moshimoshi-prod --tail 50
```

## Standard Rollback (< 15 minutes)

### Step 1: Initiate Rollback

```bash
# Notify team
echo "ROLLBACK INITIATED: v1.0.0 → v0.9.9" | \
  slack-cli send --channel "#deployments" --urgent

# Create incident
./scripts/create-incident.sh --severity=high --component=deployment
```

### Step 2: Database Rollback (if needed)

```bash
# Check if migrations were run
psql $DATABASE_URL -c "SELECT * FROM migrations ORDER BY id DESC LIMIT 5;"

# If migrations need reverting
npm run migrate:rollback -- --to-version=0.9.9

# Verify database state
npm run db:verify -- --version=0.9.9
```

### Step 3: Application Rollback

```bash
# List available versions
kubectl rollout history deployment/moshimoshi

# Rollback to specific revision
kubectl rollout undo deployment/moshimoshi --to-revision=<revision>

# Or deploy specific version
kubectl set image deployment/moshimoshi \
  moshimoshi=$REGISTRY/moshimoshi:v0.9.9 \
  --record

# Monitor rollback
kubectl rollout status deployment/moshimoshi --watch
```

### Step 4: Cache Invalidation

```bash
# Clear Redis cache to prevent stale data
redis-cli -h $REDIS_HOST FLUSHALL

# Or selective clear
redis-cli -h $REDIS_HOST --scan --pattern "moshimoshi:*" | xargs redis-cli DEL

# Verify cache is clean
redis-cli -h $REDIS_HOST DBSIZE
```

### Step 5: Verify Rollback

```bash
# Health checks
curl https://api.moshimoshi.app/health
curl https://api.moshimoshi.app/version
# Should show: {"version":"0.9.9"}

# Run critical tests
npm run test:smoke:prod -- --quick

# Check error rates
./scripts/check-errors.sh --last=10m
```

## Data Recovery Procedures

### If Data Corruption Detected

```bash
# 1. Stop writes immediately
kubectl scale deployment/moshimoshi --replicas=0

# 2. Restore from backup
pg_restore -d $DATABASE_URL backup_latest.sql

# 3. Verify data integrity
npm run db:integrity-check

# 4. Resume service
kubectl scale deployment/moshimoshi --replicas=3
```

### If User Sessions Lost

```bash
# Clear all sessions to force re-login
redis-cli -h $REDIS_HOST --scan --pattern "sess:*" | xargs redis-cli DEL

# Notify users
npm run notify:users -- --message="Please log in again for security"
```

## Rollback Verification Checklist

### Immediate Checks (< 2 minutes)
- [ ] Application responding (health check)
- [ ] No 500 errors in logs
- [ ] Database connected
- [ ] Redis connected
- [ ] Authentication working

### Thorough Checks (< 10 minutes)
- [ ] Run smoke tests
- [ ] Check critical user journeys
- [ ] Verify payment processing
- [ ] Check data consistency
- [ ] Monitor error rates
- [ ] Review user reports

## Communication During Rollback

### Internal Communication

```bash
# Update status every 5 minutes
while true; do
  STATUS=$(./scripts/deployment-status.sh)
  echo "Rollback Status: $STATUS" | slack-cli send --channel "#deployments"
  sleep 300
done
```

### External Communication

#### Status Page Update
```markdown
**Investigating** - We are investigating issues with the latest deployment
**Identified** - Issue identified, rollback in progress  
**Monitoring** - Rollback complete, monitoring system stability
**Resolved** - System stable, incident resolved
```

#### User Notification Template
```
We experienced a brief service disruption and have rolled back to the previous version. 
The service is now stable. We apologize for any inconvenience.

If you experience any issues, please contact support@moshimoshi.app
```

## Post-Rollback Actions

### Within 30 Minutes
1. **Incident Report Draft**
   ```bash
   ./scripts/incident-report.sh --template=rollback > incident_$(date +%Y%m%d).md
   ```

2. **Gather Logs**
   ```bash
   # Collect logs from failed deployment
   kubectl logs deployment/moshimoshi --since=1h > logs_failure.txt
   
   # Export metrics
   ./scripts/export-metrics.sh --last=1h > metrics_failure.json
   ```

3. **Notify Stakeholders**
   - Engineering team
   - Product team
   - Customer support
   - Executive team (if critical)

### Within 24 Hours
1. **Root Cause Analysis**
   - What triggered the rollback?
   - Why wasn't it caught in testing?
   - What monitoring failed?

2. **Update Runbooks**
   - Document any new issues
   - Update rollback procedures
   - Add new test cases

3. **Plan Fix**
   - Create hotfix branch
   - Schedule emergency release
   - Assign ownership

## Rollback Scenarios

### Scenario 1: Performance Degradation
```bash
# Symptoms: High response times, timeouts

# 1. Scale up temporarily
kubectl scale deployment/moshimoshi --replicas=10

# 2. Rollback if scaling doesn't help
kubectl rollout undo deployment/moshimoshi

# 3. Scale back down
kubectl scale deployment/moshimoshi --replicas=3
```

### Scenario 2: Database Migration Failure
```bash
# Symptoms: Database errors, schema mismatches

# 1. Stop application
kubectl scale deployment/moshimoshi --replicas=0

# 2. Rollback migration
npm run migrate:rollback -- --force

# 3. Deploy previous version
kubectl set image deployment/moshimoshi moshimoshi=$REGISTRY/moshimoshi:v0.9.9

# 4. Restart application
kubectl scale deployment/moshimoshi --replicas=3
```

### Scenario 3: Security Vulnerability
```bash
# Symptoms: Security alert, suspicious activity

# 1. IMMEDIATE: Block traffic
kubectl delete service moshimoshi-service

# 2. Rollback application
kubectl rollout undo deployment/moshimoshi

# 3. Patch and redeploy
# ... apply security patch ...

# 4. Restore traffic
kubectl apply -f k8s/service.yaml
```

### Scenario 4: Complete System Failure
```bash
# Symptoms: Nothing works, total outage

# 1. Switch to disaster recovery site
./scripts/dr-failover.sh --site=secondary

# 2. Restore from last known good backup
./scripts/restore-full-backup.sh --timestamp=last-good

# 3. Gradually restore traffic
./scripts/traffic-shift.sh --to=dr --percentage=10
./scripts/traffic-shift.sh --to=dr --percentage=50
./scripts/traffic-shift.sh --to=dr --percentage=100
```

## Tools and Scripts

### Monitoring During Rollback
```bash
# Real-time error monitoring
watch -n 1 'kubectl logs deployment/moshimoshi --tail=20 | grep ERROR'

# Service status
watch -n 5 './scripts/health-check-all.sh'

# User impact
watch -n 10 './scripts/active-users.sh'
```

### Useful Aliases
```bash
alias rollback-quick='kubectl rollout undo deployment/moshimoshi'
alias rollback-status='kubectl rollout status deployment/moshimoshi'
alias rollback-history='kubectl rollout history deployment/moshimoshi'
alias rollback-to='kubectl rollout undo deployment/moshimoshi --to-revision'
```

## Prevention Measures

To avoid future rollbacks:
1. Enhance staging environment to match production
2. Increase test coverage for edge cases
3. Implement canary deployments
4. Add more comprehensive monitoring
5. Conduct thorough load testing
6. Review and update runbooks regularly

## Emergency Contacts

- **On-Call Engineer**: [Phone] / [Slack]
- **Database Admin**: [Phone] / [Slack]
- **Security Team**: [Phone] / [Slack]
- **DevOps Lead**: [Phone] / [Slack]
- **CTO**: [Phone] / [Email] (Critical only)

---

**Document Version:** 1.0.0  
**Last Tested:** [Date]  
**Next Drill:** [Date + 1 month]

**Remember**: Stay calm, follow the procedures, communicate frequently.