# Automated Rollback Triggers - Gamification System

**Owner**: Agent C (Observability & Release)
**Last Updated**: 2025-10-02
**Status**: Production Ready

---

## Overview

This document defines the exact thresholds and procedures for automated rollback during the gamification system dark-launch. Automated rollback provides immediate protection against production incidents by reverting to safe state when critical metrics are breached.

---

## Rollback Decision Matrix

| Severity | Trigger | Threshold | Action | Execution Time |
|----------|---------|-----------|--------|----------------|
| **P0** | API Error Rate Spike | >5% for 5 min | Auto-rollback | <1 min |
| **P0** | Sync Queue Overflow | >1000 for 15 min | Auto-rollback | <1 min |
| **P0** | Complete Service Outage | 0 req for 5 min (peak hours) | Auto-rollback + page | <1 min |
| **P1** | P95 Latency Critical | >500ms for 10 min | Alert + manual decision | N/A |
| **P1** | Elevated Error Rate | >2% for 5 min | Alert + hold rollout | N/A |
| **P2** | Sync Failure Spike | >10% for 30 min | Alert only | N/A |

---

## Automated Rollback Triggers (P0)

### Trigger 1: API Error Rate Spike
**Condition**: Error rate >5% for 5 consecutive minutes

**Why**: Indicates catastrophic failure (half of requests failing)

**Automated Action**:
1. Webhook fires from monitoring platform
2. Execute `/scripts/rollback-all.sh --production`
3. All feature flags set to `false`
4. Redeploy triggered
5. Incident notification sent to Slack + email

**Manual Override**:
- If false alarm, rollback can be reversed within 5 minutes
- Requires Supervisor approval

**Verification**:
- Error rate drops below 1% within 5 minutes
- Dashboards show green status

---

### Trigger 2: Sync Queue Overflow
**Condition**: Sync queue size >1000 items for 15 consecutive minutes

**Why**: Indicates sync system breakdown (cannot keep up with load)

**Automated Action**:
1. Webhook fires
2. Execute rollback script
3. Disable `SYNC_ENABLED` flag
4. Trigger nightly recompute to catch up
5. Alert sent to on-call

**Manual Intervention**:
- Investigate cause of queue buildup
- May be transient (offline users returning)
- Review circuit breaker status

**Verification**:
- Queue drains to <100 items within 30 minutes
- Sync success rate >95%

---

### Trigger 3: Complete Service Outage
**Condition**: 0 requests to `/api/stats/unified` for 5 minutes during peak hours (09:00-22:00 UTC)

**Why**: Indicates total service failure

**Automated Action**:
1. Immediate page to on-call engineer
2. Execute rollback script
3. Check service health (pods, database, network)
4. Restart services if needed
5. Escalate to infrastructure team

**Peak Hours Definition**:
- Monday-Sunday: 09:00-22:00 UTC
- Outside peak: Alert only (no auto-rollback)

**Verification**:
- Service returns 200 OK on health check
- Request rate returns to baseline

---

## Manual Decision Triggers (P1)

### Trigger 4: P95 Latency Critical
**Condition**: P95 latency >500ms for 10 minutes

**Action**: Alert on-call, hold further rollout

**Decision Points**:
- If at 10%: Hold and investigate
- If at 50%: Consider rollback to 10%
- If at 100%: Urgent optimization needed

**Investigation**:
1. Check database query performance
2. Review connection pool usage
3. Check for database lock contention
4. Review application logs for slow operations

**Resolution**:
- If fixable quickly (<1 hour): Fix and continue
- If requires major changes: Rollback and schedule fix

---

### Trigger 5: Elevated Error Rate
**Condition**: Error rate >2% for 5 minutes

**Action**: Alert + hold rollout percentage

**Decision Points**:
- 2-3%: Warning, monitor closely
- 3-5%: Investigate immediately
- >5%: Auto-rollback (P0 trigger)

**Investigation**:
1. Review error types (auth, validation, database)
2. Check recent code deployments
3. Review monitoring dashboards
4. Check for regional issues

---

## Rollback Execution Procedure

### Automated Rollback (P0 Triggers)

**Step 1: Webhook Trigger**
```yaml
# Monitoring platform webhook configuration
webhook_url: https://api.moshimoshi.app/webhooks/rollback
method: POST
headers:
  Authorization: Bearer $ROLLBACK_SECRET
body:
  trigger: "error_rate_spike"
  severity: "P0"
  threshold_breached: "5% errors for 5 min"
  timestamp: "2025-10-02T14:30:00Z"
```

**Step 2: Rollback Script Execution**
```bash
# Webhook handler calls
/scripts/rollback-all.sh --production

# Script executes:
# 1. Disable all feature flags
# 2. Trigger redeployment
# 3. Verify service health
# 4. Log rollback event
# 5. Send notifications
```

**Step 3: Verification**
- Monitor dashboards for metric recovery
- Verify error rate drops below 1%
- Check service health endpoint
- Confirm user-facing features working

**Step 4: Post-Rollback**
- Run nightly recompute to fix data drift
- Review logs for root cause
- Create incident report
- Schedule fix before re-enabling

---

### Manual Rollback (P1 Decisions)

**When to Execute**:
- P1 trigger sustained for >30 minutes
- Multiple P1 triggers simultaneously
- Supervisor approval obtained
- User complaints spike

**Execution**:
```bash
# From terminal
cd /home/beano/DevProjects/next_js/moshimoshi
./scripts/rollback-all.sh --production

# Confirm when prompted
# Type: ROLLBACK-PROD
```

**Communication**:
1. Post in #moshi-prod-launch:
   ```
   🚨 ROLLBACK EXECUTED
   Time: [timestamp]
   Trigger: [reason]
   Status: In progress / Complete
   Next steps: [investigation plan]
   ```

2. Update status page if user-facing

3. Email stakeholders

---

## Rollback Verification Checklist

After rollback executed, verify:

- [ ] Error rate <1%
- [ ] P95 latency <200ms
- [ ] Sync queue <100 items
- [ ] Service health check returns 200 OK
- [ ] User-facing features working
- [ ] No new errors in logs
- [ ] Feature flags confirmed OFF
- [ ] Rollback logged in `/logs/rollback-*.log`
- [ ] Team notified in Slack
- [ ] Incident report created

---

## Post-Rollback Recovery

### Immediate Actions (0-1 hour)
1. **Investigate Root Cause**
   - Review application logs
   - Check monitoring dashboards
   - Identify exact failure point
   - Document findings

2. **Run Data Repair**
   ```bash
   npm run scripts:nightly-recompute
   ```
   - Fixes any data drift during incident
   - Recalculates streaks from canonical dates
   - Verifies data integrity

3. **Communicate Status**
   - Update #moshi-prod-launch
   - Post-mortem scheduled
   - ETA for fix provided

### Short-Term Actions (1-24 hours)
1. **Fix Root Cause**
   - Implement fix
   - Test in staging
   - Verify fix resolves issue

2. **Regression Testing**
   - Re-run load tests
   - Re-run E2E tests
   - Verify SLOs met

3. **Prepare for Re-Enable**
   - Update runbooks if needed
   - Add monitoring for failure mode
   - Get Supervisor approval

### Long-Term Actions (1-7 days)
1. **Post-Mortem**
   - Complete incident report
   - Document lessons learned
   - Update playbooks

2. **Prevention**
   - Add tests for failure scenario
   - Improve monitoring/alerting
   - Consider architecture changes

---

## Rollback Scripts Reference

### Full Rollback
```bash
./scripts/rollback-all.sh --production
```
- Disables all feature flags
- Returns to legacy/safe state
- Execution time: <1 minute

### Partial Rollback (to previous %)
```bash
# From 100% back to 50%
vercel env add ROLLOUT_PERCENTAGE 50 production --yes --force
vercel --prod --yes

# From 50% back to 10%
vercel env add ROLLOUT_PERCENTAGE 10 production --yes --force
vercel --prod --yes
```

### Feature-Specific Rollback
```bash
# Disable only sync
vercel env rm SYNC_ENABLED production --yes
vercel --prod --yes

# Disable only leaderboard deltas
vercel env rm LEADERBOARD_DELTAS production --yes
vercel --prod --yes
```

---

## Testing Automated Rollback

### Staging Test Procedure

**Test 1: Simulate Error Rate Spike**
```bash
# Inject errors into staging
# Watch webhook fire
# Verify rollback executes
```

**Test 2: Verify Rollback Script**
```bash
# Run rollback script in staging
./scripts/rollback-all.sh

# Verify:
# - Flags disabled
# - Service still running
# - Execution time <1 min
# - Logs created
```

**Test 3: Webhook Integration**
```bash
# Trigger webhook manually
curl -X POST https://staging.moshimoshi.app/webhooks/rollback \
  -H "Authorization: Bearer $ROLLBACK_SECRET" \
  -d '{"trigger":"test","severity":"P0"}'

# Verify rollback executes
```

---

## Monitoring Integration

### DataDog/Cloud Monitoring Alerts

**Alert Rule: API Error Rate Spike**
```yaml
name: "Gamification - API Error Rate Spike (Auto-Rollback)"
query: "avg(last_5m):rate(gamification.errors{*}) > 0.05"
message: |
  @webhook-rollback @pagerduty
  API error rate >5% for 5 minutes.
  Auto-rollback triggered.
thresholds:
  critical: 0.05
  warning: 0.02
```

**Alert Rule: Sync Queue Overflow**
```yaml
name: "Gamification - Sync Queue Overflow (Auto-Rollback)"
query: "avg(last_15m):gamification.sync_queue_size{*} > 1000"
message: |
  @webhook-rollback @pagerduty
  Sync queue >1000 items for 15 minutes.
  Auto-rollback triggered.
thresholds:
  critical: 1000
  warning: 500
```

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Primary On-Call | Agent C | 24/7 during launch |
| Secondary On-Call | Senior Engineer | Backup |
| Supervisor | QA Lead | Business hours |
| Infrastructure Team | DevOps Lead | Escalation only |

**Escalation Path**:
1. Primary On-Call (immediate)
2. Secondary On-Call (15 min timeout)
3. Supervisor (major incidents)
4. Infrastructure (platform issues)

---

## Rollback Metrics & SLIs

**Target Metrics**:
- Rollback execution time: <1 minute
- Service recovery time: <5 minutes
- Data integrity: 100% (no data loss)
- False positive rate: <1% (rare spurious rollbacks)

**SLI Monitoring**:
- Track rollback frequency (should be rare)
- Measure recovery time (trend toward faster)
- Monitor false positive alerts (reduce over time)

---

**Document Owner**: Agent C
**Review Frequency**: After each rollback event
**Next Review**: After first production rollback

