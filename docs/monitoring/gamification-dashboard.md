# Gamification System Monitoring Dashboard

**Purpose**: Real-time observability for gamification system health and performance
**Status**: Configuration documented, awaiting external service integration
**Owner**: Agent C (Observability & Release)
**Last Updated**: 2025-10-02

---

## Overview

This document defines the monitoring infrastructure for the Moshimoshi gamification system, including metrics, dashboards, and alert configurations.

## Key Metrics

### 1. API Performance Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| `api.stats.unified.latency.p50` | 50th percentile latency | <50ms | >100ms |
| `api.stats.unified.latency.p95` | 95th percentile latency | <200ms | >200ms |
| `api.stats.unified.latency.p99` | 99th percentile latency | <500ms | >500ms |
| `api.stats.unified.requests_per_minute` | Request rate | >100 (peak) | <10 (off-peak) |
| `api.stats.unified.error_rate` | Error percentage | <1% | >1% |

### 2. Gamification Event Metrics

| Metric | Description | Baseline | Alert Condition |
|--------|-------------|----------|-----------------|
| `gamification.xp_awarded.count` | XP events per minute | 50-200 | <10 or >10,000 |
| `gamification.xp_awarded.amount_total` | Total XP awarded per hour | Varies | Sudden 10x spike |
| `gamification.streak_increment.count` | Streak increments per day | Matches active users | <50% of expected |
| `gamification.streak_break.count` | Streak breaks per day | <5% of active users | >50% spike |
| `gamification.achievement_unlock.count` | Achievements per hour | 5-20 | <1 |
| `gamification.session_recorded.count` | Sessions per minute | 10-50 | <2 |

### 3. Sync & Data Integrity Metrics

| Metric | Description | Target | Alert Threshold |
|--------|-------------|--------|-----------------|
| `gamification.sync.queue_size` | Pending sync items | <100 | >1000 |
| `gamification.sync.success_rate` | Successful syncs | >95% | <90% |
| `gamification.sync.duration.p95` | Sync duration | <500ms | >2000ms |
| `gamification.sync.failures_per_hour` | Sync failures | <10 | >50 |
| `gamification.sync.processing_rate` | Items processed/min | >10 | <5 |
| `gamification.sync.retry_backoff_count` | Retry attempts | <100/hr | >500/hr |
| `gamification.sync.circuit_breaker_opens` | Circuit breaker triggers | 0 | >5/hr |

### 4. System Health Metrics

| Metric | Description | Expected | Alert |
|--------|-------------|----------|-------|
| `gamification.idempotency.duplicate_rate` | % of duplicate requests | <5% | >20% |
| `gamification.validation.failure_rate` | Invalid payloads | <1% | >5% |
| `gamification.feature_flags.enabled_count` | Active flags | Varies | Any change |
| `gamification.rate_limit.hits_per_hour` | Rate limit 429s | <50 | >200 |
| `gamification.rate_limit.saturation_pct` | Users at 80%+ of limit | <10% | >25% |
| `gamification.nightly_recompute.success` | Recompute job status | 1 (success) | 0 (failure) |
| `gamification.nightly_recompute.users_processed` | Users recomputed | All active | <90% |
| `gamification.nightly_recompute.anomalies_detected` | Data anomalies found | <10 | >100 |
| `gamification.nightly_recompute.repairs_applied` | Auto-repairs executed | <5 | >50 |
| `gamification.delta_materializer.queue_size` | Pending delta updates | <100 | >1000 |
| `gamification.delta_materializer.processing_rate` | Deltas processed/min | >50 | <10 |
| `gamification.delta_materializer.failures` | Failed delta updates | <5/hr | >20/hr |

---

## Dashboard Layouts

### Dashboard 1: Real-Time Operations

**Purpose**: Live monitoring during deployments and normal operations

**Panels**:
1. **API Health** (Top row)
   - Request rate (line chart, last 1 hour)
   - Error rate (line chart, last 1 hour)
   - P95 latency (line chart, last 1 hour)

2. **Gamification Events** (Middle row)
   - XP events per minute (counter)
   - Streak increments per day (counter)
   - Achievement unlocks per hour (counter)
   - Session recordings per minute (counter)

3. **Top Error Types** (Bottom left)
   - Bar chart of error types by frequency

4. **Slow Endpoints** (Bottom right)
   - Table of endpoints with p99 latency >500ms

**Refresh Rate**: 10 seconds

---

### Dashboard 2: Data Integrity

**Purpose**: Monitor data quality and sync health

**Panels**:
1. **Sync Queue Size** (Top left)
   - Line chart, last 24 hours
   - Alert line at 100 items

2. **Sync Success Rate** (Top right)
   - Gauge showing current %
   - Target: >95%

3. **Data Anomalies** (Middle)
   - Count of future-dated streaks (should be 0)
   - Count of negative XP values (should be 0)
   - Count of invalid streak calculations (should be 0)

4. **Idempotency Stats** (Bottom)
   - Duplicate request rate (line chart)
   - Top duplicate sources (table)

**Refresh Rate**: 1 minute

---

### Dashboard 3: User Engagement

**Purpose**: Business metrics and user behavior

**Panels**:
1. **Daily Active Users** (Top)
   - Line chart, last 30 days
   - Overlaid with streak active users

2. **XP Distribution** (Middle left)
   - Histogram of XP earned per session

3. **Streak Distribution** (Middle right)
   - Histogram of current streak lengths

4. **Top Achievement Unlocks** (Bottom)
   - Table of most unlocked achievements this week

**Refresh Rate**: 5 minutes

---

## Alert Configurations

### Critical Alerts (Page On-Call)

**Alert**: API Error Rate Spike
- **Condition**: Error rate >5% for 5 minutes
- **Severity**: P0
- **Action**: Page on-call engineer, auto-rollback if possible

**Alert**: Sync Queue Overflow
- **Condition**: Queue size >1000 for 15 minutes
- **Severity**: P0
- **Action**: Investigate sync failures, may need to pause new syncs

**Alert**: Complete Service Outage
- **Condition**: 0 requests to `/api/stats/unified` for 5 minutes during peak hours
- **Severity**: P0
- **Action**: Check service health, restart if needed

### High Priority Alerts (Slack + Email)

**Alert**: Elevated Error Rate
- **Condition**: Error rate >1% for 10 minutes
- **Severity**: P1
- **Action**: Investigate logs, may need code fix

**Alert**: API Latency Degradation
- **Condition**: P95 latency >500ms for 10 minutes
- **Severity**: P1
- **Action**: Check database indexes, caching, connection pools

**Alert**: Streak Break Spike
- **Condition**: Streak breaks >50% above 7-day baseline
- **Severity**: P1
- **Action**: May indicate bug in streak calculation or sync issues

**Alert**: Sync Failure Rate High
- **Condition**: Sync failure rate >10% for 30 minutes
- **Severity**: P1
- **Action**: Check Firebase connectivity, quota limits

### Warning Alerts (Slack Only)

**Alert**: Low Activity
- **Condition**: <10 XP events per minute for 1 hour (during peak)
- **Severity**: P2
- **Action**: May indicate user-facing issue preventing activity

**Alert**: High Duplicate Rate
- **Condition**: Idempotency duplicate rate >20% for 1 hour
- **Severity**: P2
- **Action**: Investigate why clients are retrying excessively

**Alert**: Rate Limit Saturation
- **Condition**: >25% of active users hitting 80%+ of rate limit
- **Severity**: P2
- **Action**: May need to increase limits or investigate bot activity

**Alert**: Nightly Recompute Anomalies
- **Condition**: >100 data anomalies detected in recompute job
- **Severity**: P2
- **Action**: Investigate data corruption source

**Alert**: Delta Materializer Backlog
- **Condition**: Delta queue >1000 items for 30 minutes
- **Severity**: P2
- **Action**: May need to scale delta processing or investigate failures

---

## Log Queries (Structured Logs)

All logs use JSON format with correlation IDs for tracing.

### Query 1: Find Errors for Specific User
```
service:gamification
AND metricType:api_error
AND userId:<USER_ID>
AND timestamp:[now-1h TO now]
```

### Query 2: Track Request by Correlation ID
```
correlationId:<CORRELATION_ID>
```
Shows complete request lifecycle from start to finish.

### Query 3: Slow API Requests
```
service:gamification
AND metricType:api_latency
AND duration:>500
AND timestamp:[now-1h TO now]
```

### Query 4: XP Awarded in Last Hour
```
service:gamification
AND metricType:xp_awarded
AND timestamp:[now-1h TO now]
| stats sum(amount) by source
```

### Query 5: Recent Streak Breaks
```
service:gamification
AND metricType:streak_break
AND timestamp:[now-24h TO now]
| stats count by severity
```

---

## SLO Definitions

### Service Level Objectives (Monthly)

| SLO | Target | Measurement |
|-----|--------|-------------|
| **Availability** | 99.9% | Uptime of `/api/stats/unified` endpoint |
| **Latency (P95)** | <200ms | 95% of requests complete in <200ms |
| **Error Rate** | <1% | Less than 1% of requests result in 5xx errors |
| **Data Accuracy** | 99.99% | <0.01% of streak calculations incorrect |
| **Sync Success** | 95% | 95% of sync attempts succeed within 3 retries |

### Error Budget

- **Monthly error budget**: 43 minutes of downtime (99.9% availability)
- **Weekly error budget**: 10 minutes
- **Daily error budget**: 1.4 minutes

**If error budget exhausted**:
1. Halt all non-critical deployments
2. Focus on reliability improvements
3. Require post-mortem for all incidents

---

## Implementation Steps

### Step 1: Choose Monitoring Platform
**Options**:
- **DataDog** (Recommended) - Full-featured APM with dashboards
- **Grafana + Prometheus** - Open-source, self-hosted
- **Google Cloud Monitoring** - Native GCP integration
- **New Relic** - APM with alerts

### Step 2: Instrument Code
**Already Done**:
- ✅ Structured logging with `logger.info()`
- ✅ Metric tracking with `gamificationMetrics.track*()`
- ✅ Correlation IDs for request tracing
- ✅ Performance timers for latency

**To Do**:
- Send logs to external service (via log shipper)
- Send metrics to time-series database
- Configure alert rules in monitoring platform

### Step 3: Create Dashboards
Using dashboard JSON/YAML configs from this document, create dashboards in chosen platform.

### Step 4: Set Up Alerts
Configure alert rules based on thresholds defined above.

### Step 5: Test Alerts
Trigger test alerts to verify notification channels work:
- Simulate API error spike
- Simulate latency degradation
- Verify Slack/email/pager notifications

---

## Runbook Links

- **API Error Spike**: `/docs/runbooks/api-error-spike.md`
- **Sync Queue Overflow**: `/docs/runbooks/sync-queue-overflow.md`
- **Performance Degradation**: `/docs/runbooks/performance-degradation.md`
- **Rollback Procedure**: `/docs/runbooks/gamification-rollback.md`

---

## Related Documentation

- `/docs/audits/00-Production-Plan.md` - Overall production readiness plan
- `/src/lib/telemetry/gamificationMetrics.ts` - Metrics implementation
- `/src/app/api/stats/unified/route.ts` - Instrumented API endpoint

---

**Next Actions**:
1. Select monitoring platform (DataDog recommended)
2. Set up log shipping (e.g., Winston → DataDog)
3. Create dashboards using configs above
4. Configure alert rules
5. Test end-to-end alerting
