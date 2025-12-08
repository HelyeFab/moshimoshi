# Content Integrity Checker Runbook

## Overview

The Content Integrity Checker is an automated system that ensures all content in the Moshimoshi platform has the required assets (audio, translations, images, etc.). It runs every 6 hours and can automatically repair missing content.

### Schedule

- **Runs**: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- **Max Duration**: 9 minutes per run
- **Memory Limit**: 2GiB
- **Retry**: 1 automatic retry on failure

### What It Checks

| Content Type  | Checks                                 |
| ------------- | -------------------------------------- |
| News Articles | Audio, Translations, Word Explanations |
| Stories       | Audio, Images, Stalled Drafts          |

### Repair Limits Per Run

- **News Articles**: Up to 3 articles (audio, translations, word explanations)
- **Stories**: Up to 1 story (audio, images)

---

## Architecture

```
┌─────────────────────┐
│   Cloud Scheduler   │
│  (Every 6 hours)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  contentIntegrity   │────►│  Idempotency Check  │
│  CheckerFunction    │     │  (Skip if already   │
│                     │     │   processed)        │
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  Acquire Lock       │────►│  Distributed Lock   │
│  (Prevent           │     │  (10 min expiry)    │
│   concurrent runs)  │     │                     │
└──────────┬──────────┘     └─────────────────────┘
           │
           ▼
┌─────────────────────┐
│  runIntegrityCheck  │
│                     │
│  ├─ checkNewsArticles
│  │   └─ repairNewsArticles (max 3)
│  │
│  └─ checkStories
│      └─ repairStory (max 1)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Log Results to     │
│  Firestore          │
│  integrity_check_logs
└─────────────────────┘
```

### Firestore Collections

| Collection                                  | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `integrity_check_logs`                      | Logs of all integrity checks (results, duration, repairs) |
| `ops/integrity/processed_checks/{checkId}`  | Idempotency tracking (14-day TTL)                         |
| `ops/integrity/repair_attempts/{contentId}` | Repair cooldown tracking (14-day TTL)                     |
| `ops/integrity/locks/integrity_checker`     | Distributed lock (10-min auto-expiry)                     |

---

## Normal Operations

### Verifying Scheduled Runs

1. **Admin Dashboard**
   - Navigate to `/admin/integrity-monitor`
   - Check "Last Run" timestamp
   - Review "Total Checks (7d)" count

2. **Firebase Console**

   ```
   Firestore > integrity_check_logs
   Sort by: createdAt (descending)
   ```

3. **Cloud Functions Logs**
   ```bash
   firebase functions:log --only contentIntegrityCheckerFunction
   ```

### Expected Healthy State

- Last run < 6 hours ago
- Queue depth = 0 (or very low)
- Repair success rate > 90%
- No errors in recent logs

---

## Manual Trigger Methods

### Method 1: Admin Dashboard (Recommended)

1. Navigate to `/admin/integrity-monitor`
2. Click **"Run Check"** button
3. Wait for completion (up to 9 minutes)
4. Review results in the logs section

### Method 2: Firebase Console

1. Go to Firebase Console > Functions
2. Find `manualIntegrityCheckerFunction`
3. Click **"Test function"**
4. Use this payload:
   ```json
   {
     "data": {
       "adminKey": "integrity-checker-2025"
     }
   }
   ```

### Method 3: cURL Command

```bash
curl -X POST \
  "https://us-central1-moshimoshi-de237.cloudfunctions.net/manualIntegrityCheckerFunction" \
  -H "Content-Type: application/json" \
  -d '{"data": {"adminKey": "integrity-checker-2025"}}'
```

### Method 4: Node.js Script

```bash
cd /path/to/moshimoshi
node scripts/trigger-integrity-check.js
```

---

## Emergency Procedures

### Scenario: Mass Missing Audio

**Symptoms:**

- Many articles showing "Missing Audio" in dashboard
- Queue depth > 20
- Users reporting no audio playback

**Actions:**

1. **Assess Scope**

   ```
   Firestore > news_articles
   Query: hasAudioSegments == false
   Order by: publishedAt desc
   ```

2. **Trigger Manual Check**
   - Use admin dashboard or cURL method
   - Note: Only 3 articles repaired per run

3. **Bulk Repair (if many articles)**

   ```bash
   # Run multiple times with cooldown
   for i in {1..5}; do
     node scripts/trigger-integrity-check.js
     echo "Waiting 10 minutes before next run..."
     sleep 600
   done
   ```

4. **Monitor Progress**
   - Watch dashboard for queue depth decrease
   - Check repair success rate

### Scenario: TTS API Rate Limit

**Symptoms:**

- Repair failures in logs
- Error: "TTS API rate limit exceeded"
- Circuit breaker triggered (24h cooldown)

**Actions:**

1. **Wait for Cooldown**
   - Circuit breaker auto-resets after 24 hours
   - Do NOT manually retry during cooldown

2. **Check TTS Service Status**
   - Verify Modal/ElevenLabs API status
   - Check API quota in respective dashboards

3. **Adjust Repair Limits** (if persistent)
   - Edit `functions/src/utils/integrityChecker.ts`
   - Reduce `MAX_ARTICLES_TO_REPAIR` temporarily

### Scenario: Stalled Drafts

**Symptoms:**

- Stories stuck in "draft" status
- `stalledDrafts` array in logs is populated

**Actions:**

1. **Identify Stalled Stories**

   ```
   Firestore > stories
   Query: status == "draft" AND updatedAt < (now - 1 hour)
   ```

2. **Check AI Generation Logs**
   - Review story generation function logs
   - Look for OpenAI/Gemini API errors

3. **Manual Resolution**
   - For each stalled story:
     - Delete and regenerate, OR
     - Manually update status to "published" if complete

---

## Troubleshooting

### Common Errors

| Error                    | Cause                    | Solution                                   |
| ------------------------ | ------------------------ | ------------------------------------------ |
| "Lock already held"      | Another check is running | Wait 10 minutes for lock expiry            |
| "TTS API rate limit"     | Too many audio requests  | Wait for cooldown (6-24 hours)             |
| "OpenAI quota exceeded"  | AI API quota depleted    | Check OpenAI dashboard, add credits        |
| "Database not available" | Firebase initialization  | Check Firebase Admin SDK config            |
| "Unauthorized"           | Missing admin key        | Verify INTEGRITY_CHECKER_ADMIN_KEY env var |

### Debugging Steps

1. **Check Cloud Function Logs**

   ```bash
   firebase functions:log --only contentIntegrityCheckerFunction --limit 100
   ```

2. **Review Idempotency State**

   ```
   Firestore > ops > integrity > processed_checks
   Look for recent entries with status "failed"
   ```

3. **Check Repair Cooldowns**

   ```
   Firestore > ops > integrity > repair_attempts
   Look for items with high consecutiveFailures
   ```

4. **Verify Lock Status**
   ```
   Firestore > ops > integrity > locks > integrity_checker
   Check if lock is stale (expiresAt in the past)
   ```

---

## Monitoring & Alerts

### Dashboard Metrics

| Metric              | Healthy | Warning   | Critical |
| ------------------- | ------- | --------- | -------- |
| Queue Depth         | 0-5     | 6-10      | >10      |
| Repair Success Rate | >90%    | 70-90%    | <70%     |
| Last Run            | <6h ago | 6-12h ago | >12h ago |
| Failed Checks (7d)  | 0-1     | 2-3       | >3       |

### Alert Thresholds

| Level     | Condition                                   | Action                     |
| --------- | ------------------------------------------- | -------------------------- |
| INFO      | Queue depth > 5                             | Monitor next scheduled run |
| WARNING   | Queue depth > 10 OR success rate < 80%      | Trigger manual check       |
| CRITICAL  | Queue depth > 20 OR 2+ consecutive failures | Immediate investigation    |
| EMERGENCY | No check in 24h OR all repairs failing      | Contact on-call engineer   |

### Setting Up Cloud Monitoring Alerts

```yaml
# alerting-policy.yaml
displayName: 'Integrity Check Failures'
conditions:
  - displayName: 'High failure rate'
    conditionThreshold:
      filter: 'resource.type="cloud_function" AND metric.type="logging.googleapis.com/log_entry_count" AND textPayload:"[ContentIntegrityChecker] Fatal error"'
      comparison: COMPARISON_GT
      thresholdValue: 2
      duration: 3600s
```

---

## Configuration

### Environment Variables

| Variable                      | Default                                                   | Description                   |
| ----------------------------- | --------------------------------------------------------- | ----------------------------- |
| `INTEGRITY_CHECKER_ADMIN_KEY` | `integrity-checker-2025`                                  | Admin key for manual triggers |
| `FIREBASE_FUNCTIONS_URL`      | `https://us-central1-moshimoshi-de237.cloudfunctions.net` | Functions base URL            |
| `MODAL_API_KEY`               | (secret)                                                  | API key for Modal TTS         |
| `OPENAI_API_KEY`              | (secret)                                                  | API key for OpenAI            |

### Adjustable Limits

Located in `functions/src/utils/integrityChecker.ts`:

```typescript
const MAX_ARTICLES_TO_REPAIR = 3 // Articles per run
const MAX_STORIES_TO_REPAIR = 1 // Stories per run
const LOOKBACK_DAYS = 7 // Days to check for content
```

### Idempotency Configuration

Located in `functions/src/utils/integrityIdempotency.ts`:

```typescript
const IDEMPOTENCY_CONFIG = {
  REPAIR_COOLDOWN_HOURS: 6, // Wait between repair attempts
  MAX_CONSECUTIVE_FAILURES: 3, // Circuit breaker threshold
  LOCK_EXPIRY_MINUTES: 10, // Lock auto-release
  CHECK_TTL_DAYS: 14, // Idempotency record retention
  REPAIR_TTL_DAYS: 14, // Repair attempt record retention
  EXTENDED_COOLDOWN_HOURS: 24, // Cooldown after circuit breaker trips
}
```

---

## Recovery Procedures

### Resetting Circuit Breaker

If content is stuck due to circuit breaker:

1. **Identify Affected Content**

   ```
   Firestore > ops > integrity > repair_attempts
   Query: consecutiveFailures >= 3
   ```

2. **Delete Repair Records** (Caution!)

   ```javascript
   // Firebase Console > Firestore
   // Select documents with high consecutiveFailures
   // Delete to reset cooldown
   ```

3. **Trigger New Check**
   - Use admin dashboard to run check
   - Monitor for successful repairs

### Clearing Stale Lock

If lock is stuck (rare):

1. **Check Lock Document**

   ```
   Firestore > ops > integrity > locks > integrity_checker
   ```

2. **If expiresAt is in the past, delete it**
   - This allows next scheduled run to proceed

### Full Reset (Last Resort)

To completely reset integrity checker state:

1. **Delete All Records**

   ```
   Firestore > ops > integrity > processed_checks (delete all)
   Firestore > ops > integrity > repair_attempts (delete all)
   Firestore > ops > integrity > locks (delete all)
   ```

2. **Trigger Fresh Check**
   - Use manual trigger method
   - This will check all content from scratch

---

## Performance Benchmarks

### Expected Durations

| Operation                 | Target | Maximum |
| ------------------------- | ------ | ------- |
| Full check (100 articles) | <30s   | 60s     |
| Single audio repair       | <5s    | 10s     |
| Stats calculation         | <100ms | 250ms   |

### Resource Usage

| Resource | Normal   | Maximum               |
| -------- | -------- | --------------------- |
| Memory   | <256MB   | 2GiB                  |
| CPU      | Low      | Burst during repairs  |
| Network  | Moderate | High during TTS calls |

---

## Contact & Escalation

1. **L1**: Check admin dashboard, review this runbook
2. **L2**: Check Cloud Function logs, review Firestore state
3. **L3**: Contact backend engineer for code-level debugging

---

_Last Updated: 2025-01-10_
_Version: 1.0.0_
