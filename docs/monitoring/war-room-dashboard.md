# War Room Dashboard - Dark-Launch Monitoring

**Purpose**: Single-view dashboard for monitoring gamification dark-launch rollout
**Owner**: Agent C (Observability & Release)
**Created**: 2025-10-02
**Status**: Ready for Production

---

## Overview

The War Room Dashboard provides real-time monitoring during the gamification system dark-launch phases (10% → 50% → 100%). This 4-panel view displays all critical metrics needed to make go/no-go decisions at each phase.

**Dashboard URL**: `https://monitoring.moshimoshi.app/dashboards/war-room`
**Refresh Rate**: 10 seconds (auto-refresh)
**Access**: On-call engineers, Supervisor, Agent C

---

## Dashboard Layout

```
┌─────────────────────────────────────────┬─────────────────────────────────────────┐
│                                         │                                         │
│  Panel 1: API Health                    │  Panel 2: Sync Queue                   │
│  - Request Rate (req/min)               │  - Queue Size (items)                  │
│  - Error Rate (%)                       │  - Processing Rate (items/min)         │
│  - P95 Latency (ms)                     │  - Failure Rate (%)                    │
│                                         │                                         │
├─────────────────────────────────────────┼─────────────────────────────────────────┤
│                                         │                                         │
│  Panel 3: Recompute Status              │  Panel 4: Leaderboard Deltas           │
│  - Last Run (timestamp)                 │  - Delta Queue Size (items)            │
│  - Users Processed (count)              │  - Processing Rate (deltas/min)        │
│  - Anomalies Detected (count)           │  - Failures (count)                    │
│  - Repairs Applied (count)              │                                         │
│                                         │                                         │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## Panel 1: API Health

### Purpose
Monitor the health of `/api/stats/unified` endpoint in real-time

### Metrics

**1.1 Request Rate** (Line Chart)
- **Metric**: `gamification.api.requests_per_minute`
- **Time Range**: Last 1 hour
- **Y-Axis**: Requests per minute (0-500)
- **Alert Threshold**: Red line at 400 (2x peak)
- **Expected Values**:
  - 10% rollout: ~20-30 req/min
  - 50% rollout: ~100-150 req/min
  - 100% rollout: ~200-250 req/min

**1.2 Error Rate** (Line Chart + Gauge)
- **Metric**: `rate(gamification.errors{*})`
- **Time Range**: Last 1 hour
- **Y-Axis**: Percentage (0-10%)
- **Alert Thresholds**:
  - Yellow (warning): 1%
  - Orange (elevated): 2%
  - Red (critical): 5%
- **Abort Condition**: >5% for 5 minutes

**1.3 P95 Latency** (Line Chart)
- **Metric**: `gamification.api_latency{percentile:95}`
- **Time Range**: Last 1 hour
- **Y-Axis**: Milliseconds (0-1000)
- **Alert Thresholds**:
  - Yellow: 200ms
  - Orange: 300ms
  - Red: 500ms
- **Abort Condition**: >300ms sustained for 10 minutes

### Visual Configuration

```json
{
  "panel": {
    "title": "API Health",
    "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
    "targets": [
      {
        "metric": "gamification.api.requests_per_minute",
        "alias": "Request Rate",
        "color": "blue"
      },
      {
        "metric": "rate(gamification.errors{*})",
        "alias": "Error Rate %",
        "color": "red",
        "yAxisID": "right"
      },
      {
        "metric": "gamification.api_latency{percentile:95}",
        "alias": "P95 Latency",
        "color": "green"
      }
    ],
    "legend": {"show": true, "position": "bottom"},
    "thresholds": [
      {"value": 200, "color": "yellow", "label": "Target P95"},
      {"value": 300, "color": "orange", "label": "Warning"},
      {"value": 500, "color": "red", "label": "Critical"}
    ]
  }
}
```

---

## Panel 2: Sync Queue

### Purpose
Monitor the offline sync queue health and processing

### Metrics

**2.1 Queue Size** (Line Chart + Current Value)
- **Metric**: `gamification.sync.queue_size`
- **Time Range**: Last 1 hour
- **Y-Axis**: Item count (0-2000)
- **Alert Thresholds**:
  - Yellow: 100 items
  - Orange: 500 items
  - Red: 1000 items
- **Abort Condition**: >1000 items for 15 minutes

**2.2 Processing Rate** (Gauge)
- **Metric**: `rate(gamification.sync.processed{*}[1m])`
- **Display**: Items per minute
- **Expected**: >10 items/min
- **Gauge Ranges**:
  - Green: >10 items/min
  - Yellow: 5-10 items/min
  - Red: <5 items/min

**2.3 Failure Rate** (Line Chart)
- **Metric**: `rate(gamification.sync.failures{*})`
- **Time Range**: Last 1 hour
- **Y-Axis**: Percentage (0-50%)
- **Alert Thresholds**:
  - Yellow: 5%
  - Orange: 10%
  - Red: 20%
- **Abort Condition**: >10% for 30 minutes

### Visual Configuration

```json
{
  "panel": {
    "title": "Sync Queue",
    "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
    "targets": [
      {
        "metric": "gamification.sync.queue_size",
        "alias": "Queue Size",
        "color": "purple"
      },
      {
        "metric": "rate(gamification.sync.processed{*}[1m])",
        "alias": "Processing Rate (items/min)",
        "type": "gauge"
      },
      {
        "metric": "rate(gamification.sync.failures{*})",
        "alias": "Failure Rate %",
        "color": "red"
      }
    ],
    "thresholds": [
      {"value": 100, "color": "yellow", "label": "Warning"},
      {"value": 500, "color": "orange", "label": "Elevated"},
      {"value": 1000, "color": "red", "label": "Critical"}
    ]
  }
}
```

---

## Panel 3: Recompute Status

### Purpose
Monitor nightly recompute job status and data health

### Metrics

**3.1 Last Run Timestamp** (Stat + Time Since)
- **Metric**: `gamification.nightly_recompute.last_run_timestamp`
- **Display**: "X hours ago" or "Last run: HH:MM UTC"
- **Expected**: Daily at 02:00 UTC
- **Alert**: If >25 hours ago (missed run)

**3.2 Users Processed** (Stat)
- **Metric**: `gamification.nightly_recompute.users_processed`
- **Display**: Count (e.g., "8,542 users")
- **Expected**: All active users
- **Alert**: If <90% of expected

**3.3 Anomalies Detected** (Stat + History)
- **Metric**: `gamification.nightly_recompute.anomalies_detected`
- **Display**: Count (e.g., "12 anomalies")
- **Historical**: Line chart of last 7 runs
- **Alert Thresholds**:
  - Green: <10 anomalies
  - Yellow: 10-50 anomalies
  - Orange: 50-100 anomalies
  - Red: >100 anomalies

**3.4 Repairs Applied** (Stat)
- **Metric**: `gamification.nightly_recompute.repairs_applied`
- **Display**: Count (e.g., "3 repairs")
- **Expected**: Low number (<10)
- **Alert**: If >50 repairs (indicates widespread issues)

### Visual Configuration

```json
{
  "panel": {
    "title": "Nightly Recompute Status",
    "gridPos": {"x": 0, "y": 8, "w": 12, "h": 8},
    "type": "stat",
    "targets": [
      {
        "metric": "gamification.nightly_recompute.last_run_timestamp",
        "alias": "Last Run",
        "unit": "time_since"
      },
      {
        "metric": "gamification.nightly_recompute.users_processed",
        "alias": "Users Processed"
      },
      {
        "metric": "gamification.nightly_recompute.anomalies_detected",
        "alias": "Anomalies",
        "sparkline": true
      },
      {
        "metric": "gamification.nightly_recompute.repairs_applied",
        "alias": "Repairs"
      }
    ],
    "thresholds": [
      {"field": "Anomalies", "value": 10, "color": "yellow"},
      {"field": "Anomalies", "value": 100, "color": "red"}
    ]
  }
}
```

---

## Panel 4: Leaderboard Deltas

### Purpose
Monitor leaderboard delta queue and materialization

### Metrics

**4.1 Delta Queue Size** (Line Chart)
- **Metric**: `gamification.delta_materializer.queue_size`
- **Time Range**: Last 1 hour
- **Y-Axis**: Item count (0-2000)
- **Alert Thresholds**:
  - Yellow: 500 deltas
  - Orange: 1000 deltas
  - Red: 2000 deltas
- **Expected**: Steady state <100 deltas

**4.2 Processing Rate** (Gauge)
- **Metric**: `rate(gamification.delta_materializer.processed{*}[1m])`
- **Display**: Deltas per minute
- **Expected**: >50 deltas/min
- **Gauge Ranges**:
  - Green: >50 deltas/min
  - Yellow: 25-50 deltas/min
  - Red: <25 deltas/min

**4.3 Failures** (Counter + Line Chart)
- **Metric**: `gamification.delta_materializer.failures`
- **Time Range**: Last 1 hour
- **Display**: Total failures in last hour
- **Alert Thresholds**:
  - Yellow: 5 failures/hr
  - Orange: 20 failures/hr
  - Red: 50 failures/hr

### Visual Configuration

```json
{
  "panel": {
    "title": "Leaderboard Deltas",
    "gridPos": {"x": 12, "y": 8, "w": 12, "h": 8},
    "targets": [
      {
        "metric": "gamification.delta_materializer.queue_size",
        "alias": "Queue Size",
        "color": "orange"
      },
      {
        "metric": "rate(gamification.delta_materializer.processed{*}[1m])",
        "alias": "Processing Rate",
        "type": "gauge"
      },
      {
        "metric": "sum(increase(gamification.delta_materializer.failures[1h]))",
        "alias": "Failures (last hour)",
        "color": "red"
      }
    ],
    "thresholds": [
      {"value": 500, "color": "yellow"},
      {"value": 1000, "color": "orange"},
      {"value": 2000, "color": "red"}
    ]
  }
}
```

---

## Rollout Decision Criteria

### 10% → 50% (After 30 minutes)

**GO Criteria** (All must be true):
- ✅ Error rate <1% sustained
- ✅ P95 latency <200ms sustained
- ✅ Sync queue <100 items
- ✅ No P0 alerts fired
- ✅ User complaints <3 in 30 minutes

**NO-GO Criteria** (Any triggers hold):
- ❌ Error rate >2%
- ❌ P95 latency >300ms
- ❌ Sync queue >500 items
- ❌ Any P0 alert
- ❌ Multiple user complaints

**Action if NO-GO**: Hold at 10%, investigate, fix, wait additional 30 min

---

### 50% → 100% (After 1 hour)

**GO Criteria** (All must be true):
- ✅ Error rate <1% sustained for 1 hour
- ✅ P95 latency <200ms sustained
- ✅ Sync queue <100 items
- ✅ No P0/P1 alerts
- ✅ Throughput increased proportionally (~5x from 10%)
- ✅ Supervisor approval

**NO-GO Criteria** (Any triggers hold):
- ❌ Error rate >1.5%
- ❌ P95 latency >250ms
- ❌ Sync queue >500 items
- ❌ Any P0/P1 alert
- ❌ Degrading trend (metrics getting worse)

**Action if NO-GO**: Hold at 50% or rollback to 10%

---

## War Room Monitoring Procedure

### Pre-Rollout (T-15 minutes)

1. **Open War Room Dashboard**
   - Verify all panels loading
   - Check data freshness (< 30 seconds old)
   - Confirm alert thresholds visible

2. **Verify Baseline Metrics**
   - Current state metrics look healthy
   - No ongoing incidents
   - Previous rollout phase stable

3. **Communication**
   - Post in #moshi-prod-launch: "Starting [10%/50%/100%] rollout in 15 minutes"
   - Confirm Supervisor on standby
   - Verify rollback script accessible

### During Rollout (T+0 to T+30/60 min)

1. **Active Monitoring** (Every 5 minutes)
   - Screenshot dashboard
   - Log metrics in war room spreadsheet
   - Check for any spikes/anomalies

2. **Update Communication** (Every 15 minutes)
   - Post status in #moshi-prod-launch
   - Report key metrics
   - Note any concerns

3. **Watch for Abort Conditions**
   - Error rate trending up
   - Latency degrading
   - Queue building up
   - Alert notifications

### Post-Rollout Decision (T+30/60 min)

1. **Metrics Review**
   - Compare to baseline
   - Check all criteria met
   - Review any anomalies

2. **Go/No-Go Decision**
   - Present metrics to Supervisor
   - Get approval to proceed or hold
   - Document decision

3. **Next Phase or Complete**
   - If GO: Execute next rollout script
   - If NO-GO: Hold and investigate
   - If complete: Monitor for 2 hours

---

## Alert Integration

### Dashboard Alerts

All panels have alert rules that:
- Send to #moshi-prod-launch Slack channel
- Email on-call engineer
- Page for P0 conditions
- Trigger automated rollback (P0 only)

### Alert Silencing

During rollout, do NOT silence:
- P0 alerts (error rate, outage)
- P1 alerts (latency, sync failures)

May silence temporarily:
- P2 informational alerts
- Routine maintenance alerts

---

## Access & Permissions

**Who Can Access**:
- Agent C (dashboard owner)
- On-call engineers (rotation)
- Supervisor (read-only)
- Senior engineers (on-demand)

**Editing**:
- Only Agent C can modify dashboard
- Changes require testing in staging first

**Sharing**:
- Dashboard is public URL (no auth required for viewing)
- Edit access requires login

---

## Troubleshooting

### Dashboard Not Loading
- Check monitoring platform status
- Verify metrics are being ingested
- Check network connectivity

### Metrics Stale
- Check application is sending metrics
- Verify metric name hasn't changed
- Review telemetry configuration

### False Alerts
- Review alert threshold (may need tuning)
- Check for test/synthetic traffic
- Verify metric calculation is correct

---

## Dashboard Maintenance

**Daily**:
- Verify metrics updating
- Check no stale data

**Weekly**:
- Review alert effectiveness
- Tune thresholds if needed

**After Each Rollout**:
- Document actual vs. expected metrics
- Update thresholds based on learnings
- Add notes to dashboard

---

**Dashboard Owner**: Agent C (Observability & Release)
**Review Frequency**: After each rollout phase
**Last Updated**: 2025-10-02
