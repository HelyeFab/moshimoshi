# Gamification System Observability Runbook

**Owner**: Agent C - Observability & Release
**Last Updated**: 2025-10-02 (Day 2)
**Status**: Production Ready

---

## Table of Contents

1. [Dashboard Access](#dashboard-access)
2. [Alert Response Procedures](#alert-response-procedures)
3. [Common Investigation Workflows](#common-investigation-workflows)
4. [On-Call Procedures](#on-call-procedures)
5. [Escalation Matrix](#escalation-matrix)
6. [Incident Templates](#incident-templates)
7. [CI/CD Artifacts & Evidence](#cicd-artifacts--evidence)
8. [Evidence Locations](#evidence-locations)

---

## Dashboard Access

### Primary Dashboards

**Dashboard 1: Real-Time Operations**
- **URL**: `https://monitoring.moshimoshi.app/dashboards/gamification-realtime`
- **Purpose**: Live monitoring during normal operations
- **Refresh**: 10 seconds
- **Key Metrics**:
  - API health (request rate, error rate, P95 latency)
  - Gamification events (XP, streaks, achievements, sessions)
  - Top error types
  - Slow endpoints

**Dashboard 2: Data Integrity**
- **URL**: `https://monitoring.moshimoshi.app/dashboards/gamification-integrity`
- **Purpose**: Monitor data quality and sync health
- **Refresh**: 1 minute
- **Key Metrics**:
  - Sync queue size
  - Sync success rate
  - Data anomalies
  - Idempotency stats

**Dashboard 3: User Engagement**
- **URL**: `https://monitoring.moshimoshi.app/dashboards/gamification-engagement`
- **Purpose**: Business metrics and user behavior
- **Refresh**: 5 minutes
- **Key Metrics**:
  - Daily active users
  - XP distribution
  - Streak distribution
  - Top achievement unlocks

**Dashboard 4: System Health (NEW - Day 2)**
- **URL**: `https://monitoring.moshimoshi.app/dashboards/gamification-system`
- **Purpose**: Infrastructure and background jobs
- **Refresh**: 1 minute
- **Key Metrics**:
  - Rate limit hits
  - Nightly recompute status
  - Delta materializer throughput
  - Circuit breaker opens
  - Sync retry backoffs

### Log Viewers

**Structured Logs**:
- **URL**: `https://logs.moshimoshi.app/search?service=gamification`
- **Format**: JSON with correlation IDs
- **Retention**: 30 days

**Audit Logs** (Day 2):
- **URL**: `https://logs.moshimoshi.app/audit?service=gamification`
- **Includes**: Unauthorized attempts, rate limit exceeded, validation failures
- **Retention**: 90 days

---

## Alert Response Procedures

### P0 (Critical) - Page On-Call

#### P0-1: API Error Rate Spike
**Alert**: Error rate >5% for 5 minutes

**Immediate Actions**:
1. Check Real-Time Operations dashboard
2. Identify error types in "Top Error Types" panel
3. Search logs: `service:gamification AND metricType:api_error AND timestamp:[now-5m TO now]`
4. Check if specific to one operation type (xp, streak, session, etc.)

**Common Causes**:
- Database connection issues
- Firebase quota exceeded
- Invalid validation logic deployed
- Network issues

**Remediation**:
- If >10% error rate: Consider rollback
- If validation errors: Check recent deployments
- If database errors: Check connection pools and indexes
- If quota exceeded: Request quota increase or optimize queries

**Escalation**: If error rate >10% for 10 minutes, page senior engineer

---

#### P0-2: Sync Queue Overflow
**Alert**: Queue size >1000 for 15 minutes

**Immediate Actions**:
1. Check Data Integrity dashboard → "Sync Queue Size" panel
2. Check sync failure rate
3. Search logs: `service:gamification AND metricType:sync_queue`
4. Identify if queue is growing or stable

**Common Causes**:
- Circuit breaker open (too many failures)
- Firebase write limits exceeded
- Network connectivity issues
- Large batch of offline users coming online simultaneously

**Remediation**:
- If circuit breaker open: Investigate underlying error, then manually reset
- If Firebase limits: Implement batching or request quota increase
- If network issues: Wait for recovery, monitor queue draining
- If large batch: This is expected, monitor for completion

**Escalation**: If queue >5000 for 30 minutes, page database team

---

#### P0-3: Complete Service Outage
**Alert**: 0 requests to `/api/stats/unified` for 5 minutes during peak hours

**Immediate Actions**:
1. Check if service is running: `kubectl get pods -n moshimoshi | grep gamification`
2. Check service health endpoint: `curl https://api.moshimoshi.app/health`
3. Check recent deployments
4. Check DNS and load balancer

**Common Causes**:
- Service crashed
- Bad deployment
- DNS misconfiguration
- Load balancer health check failing

**Remediation**:
- If pods not running: Restart deployment
- If health check failing: Check app logs for startup errors
- If bad deployment: Rollback immediately
- If DNS/LB issue: Check infrastructure logs

**Escalation**: Immediate - page infrastructure team and senior engineer

---

### P1 (High Priority) - Slack + Email

#### P1-1: Elevated Error Rate
**Alert**: Error rate >1% for 10 minutes

**Investigation Steps**:
1. Check which error types are elevated
2. Search for correlation ID patterns
3. Check if specific to user tier or operation type
4. Review recent code changes

**Response Timeline**: Fix within 4 hours

---

#### P1-2: API Latency Degradation
**Alert**: P95 latency >500ms for 10 minutes

**Investigation Steps**:
1. Check "Slow Endpoints" panel
2. Identify which operations are slow
3. Check database query performance
4. Check Redis connection pool
5. Check for database lock contention

**Common Fixes**:
- Add missing database indexes
- Optimize N+1 queries
- Increase connection pool size
- Add caching layer

**Response Timeline**: Mitigate within 2 hours

---

#### P1-3: Streak Break Spike
**Alert**: Streak breaks >50% above 7-day baseline

**Investigation Steps**:
1. Check if streak calculation logic changed
2. Check for timezone-related issues
3. Review nightly recompute logs
4. Check sync success rate

**Possible Causes**:
- Bug in streak calculation
- Timezone handling regression
- Sync failures preventing streak updates
- Nightly recompute bug

**Response Timeline**: Investigate within 1 hour, fix within 8 hours

---

#### P1-4: Sync Failure Rate High
**Alert**: Sync failure rate >10% for 30 minutes

**Investigation Steps**:
1. Check Firebase connectivity
2. Check quota limits
3. Review sync error logs
4. Check circuit breaker status

**Response Timeline**: Resolve within 4 hours

---

### P2 (Warning) - Slack Only

#### P2-1: Low Activity
**Alert**: <10 XP events per minute for 1 hour (during peak)

**Investigation**: Check if user-facing issue preventing activity

---

#### P2-2: High Duplicate Rate
**Alert**: Idempotency duplicate rate >20% for 1 hour

**Investigation**: Investigate why clients are retrying excessively

---

#### P2-3: Rate Limit Saturation (NEW - Day 2)
**Alert**: >25% of active users hitting 80%+ of rate limit

**Investigation Steps**:
1. Check rate limit hits dashboard
2. Identify affected user tiers
3. Check for bot activity patterns
4. Review recent feature launches that may increase API calls

**Possible Actions**:
- Increase rate limits if legitimate traffic
- Implement more aggressive bot detection
- Optimize client-side to reduce API calls
- Add caching for read-heavy operations

**Response Timeline**: Investigate within 24 hours

---

#### P2-4: Nightly Recompute Anomalies (NEW - Day 2)
**Alert**: >100 data anomalies detected in recompute job

**Investigation Steps**:
1. Check recompute logs for anomaly types
2. Identify if specific to certain user cohorts
3. Check for recent migration or data changes
4. Review auto-repair actions taken

**Common Anomaly Types**:
- Future-dated streaks
- Negative XP values
- Invalid streak calculations
- Missing metadata

**Response Timeline**: Review within 24 hours, fix source within 1 week

---

#### P2-5: Delta Materializer Backlog (NEW - Day 2)
**Alert**: Delta queue >1000 items for 30 minutes

**Investigation Steps**:
1. Check delta processing rate
2. Review delta materializer logs
3. Check if specific to leaderboard type (global, regional)
4. Verify Firestore write performance

**Possible Causes**:
- Slow Firestore queries
- Large batch of XP changes
- Leaderboard update logic inefficient

**Response Timeline**: Investigate within 12 hours

---

## Common Investigation Workflows

### Workflow 1: Trace Request by Correlation ID

**Purpose**: Debug specific failed request

**Steps**:
1. Get correlation ID from error logs or user report
2. Search logs: `correlationId:<CORRELATION_ID>`
3. Review complete request lifecycle:
   - Initial request received
   - Rate limit check
   - Authorization check
   - Validation
   - Service call
   - Response
4. Identify failure point
5. Check relevant metrics for that time period

**Example**:
```
correlationId:e2e_1696234567_abc123
```
Shows complete request flow from start to finish.

---

### Workflow 2: Investigate User-Specific Issue

**Purpose**: Debug issue reported by specific user

**Steps**:
1. Get user ID from report
2. Search logs: `service:gamification AND userId:<USER_ID> AND timestamp:[now-1h TO now]`
3. Check recent operations:
   - XP awards
   - Streak updates
   - Session recordings
4. Check for error patterns
5. Verify current stats: Query `user_stats` collection
6. Compare with expected state

**Example**:
```
service:gamification AND userId:user_abc123 AND metricType:api_error
```

---

### Workflow 3: Track Slow API Requests

**Purpose**: Identify performance bottlenecks

**Steps**:
1. Search logs: `service:gamification AND metricType:api_latency AND duration:>500 AND timestamp:[now-1h TO now]`
2. Group by operation type
3. Identify common patterns:
   - Specific user IDs?
   - Specific times of day?
   - Specific data sizes?
4. Review database query plans
5. Check for missing indexes

---

### Workflow 4: Monitor Nightly Recompute Job (NEW - Day 2)

**Purpose**: Ensure nightly recompute runs successfully

**Steps**:
1. Check recompute status: `gamification.nightly_recompute.success` metric
2. If failed:
   - Check logs: `service:gamification AND function:nightly_recompute AND level:error`
   - Identify error type (timeout, quota, corruption)
   - Review affected users count
3. If anomalies detected:
   - Check anomaly types: `gamification.nightly_recompute.anomalies_detected` metric
   - Review auto-repair actions: `gamification.nightly_recompute.repairs_applied` metric
   - Verify repairs were safe
4. If large drift detected:
   - Investigate recent code changes
   - Check for migration issues
   - Review sync success rate

**Expected Run Time**: 2-5 minutes (for <10k users)

---

### Workflow 5: Investigate Rate Limit Patterns (NEW - Day 2)

**Purpose**: Understand rate limiting impact on users

**Steps**:
1. Check rate limit dashboard
2. Identify users hitting limits: `gamification.rate_limit.hits_per_hour` metric
3. Search logs: `service:gamification AND metricType:api_error AND error:rate_limit_exceeded`
4. Group by user tier
5. Analyze patterns:
   - Legitimate power users?
   - Bot activity?
   - Retry storms?
6. Review tier limits:
   - Free: 100/hr
   - Premium: 500/hr
   - Admin: 10,000/hr

**Actions**:
- If legitimate: Increase tier limits or upgrade user
- If bot: Block IP or implement CAPTCHA
- If retry storm: Fix client-side retry logic

---

## On-Call Procedures

### On-Call Responsibilities

**Primary On-Call**:
- Respond to P0 alerts within 5 minutes
- Respond to P1 alerts within 30 minutes
- Monitor dashboards during deployments
- Approve emergency rollbacks

**Secondary On-Call**:
- Backup for primary
- Respond if primary unavailable (15 min timeout)

### Daily On-Call Checklist

**Morning (09:00)**:
- [ ] Review overnight alerts
- [ ] Check P2 alert queue
- [ ] Review nightly recompute logs
- [ ] Check sync queue size
- [ ] Review error rate trends

**Evening (17:00)**:
- [ ] Check for active incidents
- [ ] Review day's error patterns
- [ ] Update incident notes
- [ ] Hand off to next shift

### Deployment On-Call

**Pre-Deployment** (30 min before):
- [ ] Check all dashboards green
- [ ] Verify no active incidents
- [ ] Review rollback procedure
- [ ] Open dashboards in tabs

**During Deployment**:
- [ ] Monitor Real-Time Operations dashboard
- [ ] Watch error rate closely (5 min intervals)
- [ ] Check latency metrics
- [ ] Verify sync queue stable

**Post-Deployment** (30 min after):
- [ ] Verify metrics returned to baseline
- [ ] Check for new error types
- [ ] Review first 100 requests logs
- [ ] Approve or trigger rollback

---

## Escalation Matrix

| Severity | Initial Response | Escalate After | Escalate To |
|----------|-----------------|----------------|-------------|
| P0 | Primary On-Call (immediate) | 10 min | Senior Engineer + Manager |
| P1 | Primary On-Call (30 min) | 2 hours | Senior Engineer |
| P2 | Team Slack (1 hour) | 24 hours | Team Lead |

**Emergency Contacts**:
- Senior Engineer (Gamification): [Contact Info]
- Database Team Lead: [Contact Info]
- Infrastructure On-Call: [Contact Info]
- Manager (escalation only): [Contact Info]

---

## Incident Templates

### Template 1: API Error Spike

```markdown
## Incident: API Error Spike

**Start Time**: YYYY-MM-DD HH:MM UTC
**Severity**: P0
**Status**: Investigating / Mitigated / Resolved

### Impact
- Error rate: X%
- Affected users: ~X
- Operations affected: [list]

### Timeline
- HH:MM - Alert triggered
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Verified resolved

### Root Cause
[Description]

### Mitigation
[Steps taken]

### Prevention
[Future improvements]
```

---

### Template 2: Sync Queue Overflow

```markdown
## Incident: Sync Queue Overflow

**Start Time**: YYYY-MM-DD HH:MM UTC
**Severity**: P0
**Status**: Monitoring / Resolved

### Impact
- Queue size: X items
- Sync backlog: X minutes
- Affected: Premium users

### Investigation
- Circuit breaker status: [open/closed]
- Failure rate: X%
- Error types: [list]

### Resolution
[Actions taken]

### Follow-up
[Improvements needed]
```

---

## Quick Reference Commands

### Check Service Health
```bash
kubectl get pods -n moshimoshi | grep gamification
kubectl logs -n moshimoshi deployment/gamification-api --tail=100
```

### Check Recent Errors
```bash
# View recent API errors
cat /var/log/gamification/api.log | grep ERROR | tail -50

# Search by correlation ID
grep "correlationId:abc123" /var/log/gamification/api.log
```

### Manual Recompute (Emergency)
```bash
# Trigger manual recompute for single user
firebase functions:call manualRecompute --data '{"userId":"user123"}'

# View recompute logs
firebase functions:log --only gamificationRecompute
```

### Reset Circuit Breaker
```bash
# Via Redis CLI
redis-cli DEL circuit:gamification:sync
```

### Check Rate Limit Status
```bash
# Check user's current rate limit
redis-cli GET "ratelimit:xp:user123"

# View all rate limit keys
redis-cli KEYS "ratelimit:*" | wc -l
```

---

## CI/CD Artifacts & Evidence

### GitHub Actions Workflows

**Gamification Safety Checks**:
- **Workflow**: `.github/workflows/gamification-safety.yml`
- **Triggers**: PRs to main/develop, pushes to main/ops/observability-release
- **Jobs**:
  1. `forbidden-client-writes` - Detects localStorage writes in stats stores
  2. `type-safety` - TypeScript strict mode compilation
  3. `lint-gamification` - ESLint on gamification code
  4. `feature-flag-validation` - Validates flag usage
  5. `security-scan` - npm audit + secret detection
  6. `test-gamification` - Unit tests for stats/XP/achievements
  7. `test-e2e-gamification` - E2E scenarios (XP/streak flow, offline sync, duplicate prevention)

**Recent CI Runs**:
- **Latest Passing Run**: [GitHub Actions URL - to be filled]
- **E2E Failure Test**: [GitHub Actions URL - intentional failure test]
- **Client Write Detection**: [GitHub Actions URL - detection test]

### CI Evidence Links

**Passing CI Suite** (All checks green):
```
https://github.com/[org]/moshimoshi/actions/runs/[RUN_ID]
```
- ✅ All 7 jobs passed
- ✅ E2E tests completed
- ✅ Test videos/reports uploaded
- ✅ Branch protection requirements met

**E2E Failure Test** (Intentional):
```
https://github.com/[org]/moshimoshi/actions/runs/[RUN_ID]
```
- ❌ `test-e2e-gamification` job failed (expected)
- ✅ Pipeline blocked merge (correct behavior)
- ✅ Test videos uploaded to artifacts
- Evidence: CI correctly blocks bad code

**Client Write Detection** (Intentional):
```
https://github.com/[org]/moshimoshi/actions/runs/[RUN_ID]
```
- ❌ `forbidden-client-writes` job failed (expected)
- ✅ Detected localStorage.setItem in stats store
- ✅ Pipeline blocked merge (correct behavior)
- Evidence: Security enforcement working

### Branch Protection Rules

**Protected Branches**:
- `main` - All checks required, 1 approval (Supervisor)
- `ops/observability-release` - All checks required

**Required Status Checks**:
- [x] forbidden-client-writes
- [x] type-safety
- [x] lint-gamification
- [x] test-gamification
- [x] test-e2e-gamification
- [x] security-scan
- [x] feature-flag-validation

**Configuration Screenshot**: `docs/evidence/branch-protection.png`

### E2E Test Artifacts

**Test Scenarios**:
1. **XP/Streak Flow** (`tests/e2e/gamification-xp-streak.spec.ts`)
   - User earns XP → streak increments
   - Timezone boundary handling
   - 10 XP threshold enforcement

2. **Offline Sync** (`tests/e2e/gamification-offline-sync.spec.ts`)
   - Offline activity capture
   - Online replay with idempotency
   - Queue processing

3. **Duplicate Prevention** (`tests/e2e/gamification-duplicate-prevention.spec.ts`)
   - Same idempotencyKey rejected
   - Multiple tabs/windows
   - Race condition handling

**Test Artifacts**:
- Videos: `test-results/videos/`
- Screenshots: `test-results/screenshots/`
- Reports: `playwright-report/index.html`
- Retention: 30 days in GitHub Actions

### Load Test Results

**Latest Load Test**:
- **Report**: `docs/testing/load-test-report-YYYY-MM-DD.md`
- **Results JSON**: `tests/load/results.json`
- **Execution Date**: [Date]
- **Status**: ✅ PASS / ❌ FAIL
- **Key Metrics**:
  - P95 Latency: XXXms (target: <200ms)
  - Error Rate: X.X% (target: <1%)
  - Throughput: XXX req/min (target: ≥200 req/min)

### Security Audit

**Latest Audit**:
- **Report**: `docs/audits/security-audit-YYYY-MM-DD.md`
- **Completion Date**: [Date]
- **Status**: ✅ APPROVED / ⚠️ FINDINGS / ❌ BLOCKED
- **Tests Passed**: XX / 19
- **Critical Issues**: X (must be 0 for production)

---

## Evidence Locations

### Load & Performance Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Load Test Report | `docs/testing/load-test-report-YYYY-MM-DD.md` | [Date] |
| Load Test Results (JSON) | `tests/load/results.json` | [Date] |
| Performance Graphs | `docs/testing/graphs/` | [Date] |
| Resource Utilization | Dashboard screenshot in report | [Date] |

### Security Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Security Audit Checklist | `docs/audits/security-audit-YYYY-MM-DD.md` | [Date] |
| JWT Validation Tests | Security audit §1 | [Date] |
| Rate Limiting Tests | Security audit §3 | [Date] |
| Client Write Blocking | Security audit §4 | [Date] |
| Audit Logs Evidence | Security audit §5 | [Date] |

### CI/CD Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Passing CI Run | [GitHub Actions URL] | [Date] |
| E2E Failure Test | [GitHub Actions URL] | [Date] |
| Client Write Detection | [GitHub Actions URL] | [Date] |
| Branch Protection | Screenshot in `docs/evidence/` | [Date] |
| E2E Test Videos | GitHub Actions artifacts | [Date] |

### Monitoring Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Dashboard Screenshots | `docs/evidence/dashboards/` | [Date] |
| Alert Test Screenshots | `docs/evidence/alerts/` | [Date] |
| War Room Dashboard URL | [Live URL] | [Date] |
| Alert Configuration | `docs/monitoring/gamification-dashboard.md` | [Date] |

### Rollback Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Rollback Scripts | `scripts/rollback-*.sh` | [Date] |
| Staging Test Logs | `logs/staging-rollback-test-YYYY-MM-DD.log` | [Date] |
| Automated Triggers Doc | `docs/runbooks/automated-rollback.md` | [Date] |
| Rollout Scripts | `scripts/rollout-*.sh` | [Date] |

### Integration Evidence

| Artifact | Location | Last Updated |
|----------|----------|--------------|
| Agent A Confirmation | QA Matrix or GitHub issue | [Date] |
| Agent B Migration Report | `docs/audits/AGENT_B_IMPLEMENTATION_SUMMARY.md` | 2025-10-02 |
| Delta Integration | Code review link | [Date] |
| UserStatsService Update | PR link | [Date] |

### Supervisor Evidence Bundle

| Artifact | Location | Purpose |
|----------|----------|---------|
| Day 3+4 Evidence Bundle | `docs/audits/day-3-4-evidence-bundle.md` | Consolidated evidence for go/no-go |
| QA Matrix Updates | `docs/audits/qa-matrix.md` | Checklist with all evidence links |
| Final Recommendation | Evidence bundle summary | GO / NO-GO decision support |

---

### How to Access Evidence

**For Day 3+4 Gate Review**:
1. Open evidence bundle: `docs/audits/day-3-4-evidence-bundle.md`
2. Click links to individual artifacts
3. Verify screenshots and test results
4. Check all checklist items have ✅
5. Review final recommendation

**For Incident Investigation**:
1. Check monitoring dashboards (live URLs above)
2. Search logs using correlation ID
3. Review recent CI runs for code changes
4. Check rollback logs if relevant

**For Audit Trail**:
1. Security audit reports in `docs/audits/`
2. Load test reports in `docs/testing/`
3. CI run history in GitHub Actions
4. Rollback logs in `logs/`

---

**End of Runbook**

For updates or questions, contact Agent C (Observability Team).
