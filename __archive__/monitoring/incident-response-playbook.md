# Incident Response Playbook
## SRE Week 3 - Production Operations Guide

### Table of Contents
1. [Incident Severity Levels](#incident-severity-levels)
2. [Response Procedures](#response-procedures)
3. [Common Incidents & Resolutions](#common-incidents--resolutions)
4. [Escalation Matrix](#escalation-matrix)
5. [Communication Templates](#communication-templates)
6. [Post-Incident Process](#post-incident-process)

---

## Incident Severity Levels

### SEV-1: Critical (Immediate Response)
**Response Time**: < 5 minutes  
**On-Call**: Page immediately  
**Examples**:
- Complete service outage
- Data corruption or loss
- Security breach
- Payment processing failure
- Error rate > 5%

### SEV-2: High (Rapid Response)
**Response Time**: < 15 minutes  
**On-Call**: Page after 5 minutes  
**Examples**:
- Partial service degradation
- Response time > 1 second (p95)
- Error rate > 1%
- Critical feature broken
- Database replication lag > 30s

### SEV-3: Medium (Quick Response)
**Response Time**: < 30 minutes  
**On-Call**: Slack notification  
**Examples**:
- Non-critical feature failure
- Performance degradation < 50%
- Elevated error rate < 1%
- Cache failures

### SEV-4: Low (Business Hours)
**Response Time**: < 4 hours  
**On-Call**: Email notification  
**Examples**:
- UI glitches
- Minor performance issues
- Non-critical alerts

---

## Response Procedures

### Initial Response (All Severities)

```bash
# 1. Acknowledge incident
curl -X POST https://api.pagerduty.com/incidents/{id}/acknowledge

# 2. Join war room
slack://channel?team=TEAM_ID&id=war-room

# 3. Start incident timeline
echo "$(date): Incident started - [description]" >> incident.log

# 4. Check system status
./scripts/health-check.sh
```

### SEV-1 Response Procedure

#### Minute 0-5: Immediate Actions
1. **Acknowledge alert**
2. **Join war room channel**
3. **Assign Incident Commander (IC)**
4. **Initial assessment**:
   ```bash
   # Check critical metrics
   curl http://metrics.internal/api/critical
   
   # Check error logs
   kubectl logs -n production --tail=100 -l app=review-engine
   
   # Check database status
   gcloud firestore operations list
   ```

#### Minute 5-10: Diagnosis
1. **Identify scope**:
   - Affected services
   - User impact percentage
   - Geographic regions affected
   
2. **Check recent changes**:
   ```bash
   # Recent deployments
   kubectl rollout history deployment/review-engine -n production
   
   # Recent config changes
   git log --oneline -10 -- config/
   ```

#### Minute 10-15: Mitigation
1. **Decision point**: Rollback or fix forward?
   
   **Rollback** (if deployment-related):
   ```bash
   # Initiate rollback
   kubectl rollout undo deployment/review-engine -n production
   
   # Verify rollback
   kubectl rollout status deployment/review-engine -n production
   ```
   
   **Fix Forward** (if configuration/data issue):
   ```bash
   # Apply hotfix
   kubectl apply -f emergency-fix.yaml
   
   # Scale up if needed
   kubectl scale deployment/review-engine --replicas=10
   ```

2. **Verify mitigation**:
   ```bash
   # Check metrics
   curl http://metrics.internal/api/verify
   
   # Run smoke tests
   npm run test:smoke:prod
   ```

### SEV-2 Response Procedure

1. **Initial Assessment** (0-15 min):
   ```bash
   # Check specific service metrics
   curl http://metrics.internal/api/service/{service_name}
   
   # Check dependencies
   ./scripts/check-dependencies.sh
   ```

2. **Mitigation** (15-30 min):
   - Apply targeted fixes
   - Scale affected services
   - Clear caches if needed
   - Redirect traffic if necessary

### SEV-3/4 Response Procedure

1. **Investigation**:
   - Review logs and metrics
   - Reproduce issue in staging
   - Document findings

2. **Resolution**:
   - Create fix PR
   - Test in staging
   - Schedule deployment

---

## Common Incidents & Resolutions

### 1. High Error Rate

**Symptoms**: Error rate > 1%

**Diagnosis**:
```bash
# Check error distribution
curl http://metrics.internal/api/errors/breakdown

# Check recent deployments
kubectl get events -n production --sort-by='.lastTimestamp'
```

**Resolution**:
1. If deployment-related → Rollback
2. If traffic spike → Scale up
3. If database issue → Check connection pool
4. If external service → Activate circuit breaker

### 2. High Latency

**Symptoms**: p95 > 500ms

**Diagnosis**:
```bash
# Check slow queries
SELECT * FROM performance_schema.events_statements_summary_by_digest 
ORDER BY sum_timer_wait DESC LIMIT 10;

# Check cache hit rate
redis-cli INFO stats | grep hit_rate
```

**Resolution**:
1. Database: Add indexes, optimize queries
2. Cache miss: Warm cache, check eviction
3. CPU bound: Scale horizontally
4. Memory pressure: Increase limits or optimize

### 3. Database Connection Failures

**Symptoms**: "Connection pool exhausted" errors

**Diagnosis**:
```bash
# Check connection count
SELECT count(*) FROM pg_stat_activity;

# Check for locks
SELECT * FROM pg_locks WHERE granted = false;
```

**Resolution**:
```bash
# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' AND state_change < now() - interval '10 minutes';

# Increase connection pool
kubectl set env deployment/review-engine DB_POOL_SIZE=50
```

### 4. Redis/Cache Failures

**Symptoms**: Cache connection errors, high latency

**Diagnosis**:
```bash
# Check Redis memory
redis-cli INFO memory

# Check Redis persistence
redis-cli CONFIG GET save
```

**Resolution**:
```bash
# Flush cache if corrupted
redis-cli FLUSHDB

# Increase memory limit
redis-cli CONFIG SET maxmemory 2gb

# Restart Redis
kubectl rollout restart statefulset/redis
```

### 5. Sync System Failures

**Symptoms**: Sync failure rate > 5%

**Resolution**:
```bash
# Reset sync queue
curl -X POST http://api.internal/admin/sync/reset

# Clear corrupted sync data
node scripts/clear-sync-conflicts.js

# Increase sync retry limits
kubectl set env deployment/review-engine SYNC_MAX_RETRIES=5
```

### 6. Memory Leaks

**Symptoms**: Gradually increasing memory usage

**Diagnosis**:
```bash
# Take heap snapshot
kubectl exec -it review-engine-xxx -- kill -USR2 1

# Analyze memory
kubectl exec -it review-engine-xxx -- node --inspect
```

**Resolution**:
1. Immediate: Restart pods
2. Short-term: Increase memory limits
3. Long-term: Fix memory leak in code

### 7. TTS Service Failures

**Symptoms**: TTS synthesis errors

**Resolution**:
```bash
# Switch to backup provider
kubectl set env deployment/review-engine TTS_PROVIDER=backup

# Clear TTS cache
redis-cli DEL "tts:*"

# Disable TTS temporarily
kubectl set env deployment/review-engine TTS_ENABLED=false
```

---

## Escalation Matrix

### On-Call Rotation

| Role | Primary | Secondary | Manager |
|------|---------|-----------|---------|
| SRE | @alice | @bob | @carol |
| Backend | @david | @eve | @frank |
| Database | @grace | @henry | @ivan |
| Security | @jack | @kate | @liam |

### Escalation Path

```
SEV-1: Primary (0 min) → Secondary (5 min) → Manager (10 min) → VP (20 min)
SEV-2: Primary (0 min) → Secondary (15 min) → Manager (30 min)
SEV-3: Primary (0 min) → Secondary (30 min)
SEV-4: Primary (business hours only)
```

### External Escalation

| Service | Contact | Phone | Email |
|---------|---------|-------|-------|
| AWS | Premium Support | 1-800-xxx | support@aws |
| Stripe | Technical Support | 1-800-xxx | support@stripe |
| Firebase | Google Cloud Support | 1-800-xxx | support@google |

---

## Communication Templates

### Initial Incident Notification

```
🚨 INCIDENT DETECTED 🚨
Severity: SEV-[1/2/3/4]
Service: [Service Name]
Impact: [User impact description]
Status: INVESTIGATING
IC: @[name]
War Room: #incident-[timestamp]
Status Page: Updated/Updating
Next Update: [time]
```

### Status Update Template

```
📊 INCIDENT UPDATE
Time: [timestamp]
Status: [INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED]
Current Impact: [description]
Actions Taken: [list]
Next Steps: [list]
ETA: [time or unknown]
```

### Resolution Notification

```
✅ INCIDENT RESOLVED
Duration: [time]
Root Cause: [brief description]
Resolution: [what fixed it]
User Impact: [metrics]
Follow-up: [link to postmortem]
```

### Customer Communication

#### Initial (SEV-1/2 only)
```
Subject: Service Disruption Notification

We are currently experiencing issues with [service].
Our team is actively working on a resolution.

Impact: [what users might experience]
Workaround: [if available]

Updates: https://status.yourapp.com
```

#### Resolution
```
Subject: Service Restored

The issue affecting [service] has been resolved.
All systems are now operating normally.

Duration: [start time] - [end time]
Impact: [what happened]

We apologize for any inconvenience.
```

---

## Post-Incident Process

### Immediate (Within 24 hours)

1. **Update incident ticket** with resolution details
2. **Archive war room** channel
3. **Save logs and metrics** from incident window
4. **Create postmortem document** from template

### Postmortem (Within 48 hours)

#### Template Structure

```markdown
# Postmortem: [Incident Title]
Date: [Date]
Authors: [Names]
Status: [Draft/Final]

## Summary
- Duration: [start] - [end]
- Impact: [user impact metrics]
- Root Cause: [one sentence]

## Timeline
- HH:MM - Event description
- HH:MM - Event description

## Root Cause Analysis
[Detailed explanation]

## Resolution
[What fixed it]

## Lessons Learned
### What Went Well
- Item 1
- Item 2

### What Went Wrong
- Item 1
- Item 2

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |

## Supporting Information
- Dashboards: [links]
- Logs: [links]
- Metrics: [links]
```

### Follow-up Actions

1. **Schedule postmortem review** (within 1 week)
2. **Implement action items** (track in JIRA)
3. **Update runbooks** based on learnings
4. **Share learnings** with broader team
5. **Update monitoring** to catch similar issues

---

## Quick Reference Commands

### Health Checks
```bash
# Overall health
curl http://localhost:3000/api/health

# Dependency health
curl http://localhost:3000/api/health/dependencies

# Database health
curl http://localhost:3000/api/health/database

# Redis health
redis-cli PING
```

### Rollback Commands
```bash
# Kubernetes rollback
kubectl rollout undo deployment/review-engine -n production

# Database rollback
psql -c "SELECT pg_restore_point('before_incident');"

# Feature flag disable
curl -X POST http://api.internal/flags/disable -d '{"flag":"new_feature"}'
```

### Scale Commands
```bash
# Scale up
kubectl scale deployment/review-engine --replicas=20

# Scale down
kubectl scale deployment/review-engine --replicas=5

# Autoscale
kubectl autoscale deployment/review-engine --min=5 --max=50 --cpu-percent=70
```

### Cache Commands
```bash
# Clear all cache
redis-cli FLUSHALL

# Clear specific pattern
redis-cli --scan --pattern "session:*" | xargs redis-cli DEL

# Check memory
redis-cli INFO memory
```

---

## Important URLs

- **Monitoring Dashboard**: https://monitoring.internal
- **Status Page**: https://status.yourapp.com
- **Logs**: https://logs.internal
- **Metrics**: https://metrics.internal
- **PagerDuty**: https://yourcompany.pagerduty.com
- **War Room**: slack://channel?team=TEAM&id=war-room
- **Runbooks**: https://wiki.internal/runbooks
- **Postmortems**: https://wiki.internal/postmortems

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| VP Engineering | John Doe | +1-xxx-xxx | john@company |
| CTO | Jane Smith | +1-xxx-xxx | jane@company |
| Security Lead | Bob Wilson | +1-xxx-xxx | bob@company |
| Database Admin | Alice Brown | +1-xxx-xxx | alice@company |

---

**Remember**: Stay calm, communicate clearly, and focus on mitigation first, then root cause.