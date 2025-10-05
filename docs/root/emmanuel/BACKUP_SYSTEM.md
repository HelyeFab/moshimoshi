# Firebase Backup & Disaster Recovery System

Complete guide to the 3-tier backup strategy for Moshimoshi Firebase database.

## 🎯 Overview

The backup system provides **triple protection** for your Firebase Firestore data:

1. **Point-in-Time Recovery (PITR)** - Restore to any point in last 7 days
2. **Automated Daily Backups** - Full database exports every night
3. **Manual Backups** - On-demand backups from admin dashboard

## 🚀 Quick Start (5 Minutes)

### Step 1: Enable PITR (CRITICAL - Do This First!)

```bash
cd /home/beano/DevProjects/next_js/moshimoshi
./scripts/enable-pitr.sh
```

**What this does:**
- ✅ Enables 7-day Point-in-Time Recovery
- ✅ Allows restoring database to any moment in the last week
- ✅ Automatic - no maintenance required
- ⚠️ Increases storage costs by ~25%

**Time:** 2 minutes

---

### Step 2: Test Manual Backup

1. Start your development server:
```bash
npm run dev
```

2. Visit admin dashboard:
   - http://localhost:3001/admin/monitoring

3. Click **"Backup Now"** button in the "Database Backup & Protection" section

4. Verify backup status shows:
   - ✅ PITR: ENABLED
   - ✅ Last successful backup timestamp

**Time:** 3 minutes

---

### Step 3: Setup Automated Backups (Optional but Recommended)

```bash
./scripts/setup-backups.sh
```

**What this does:**
- ⏰ Creates Cloud Scheduler job
- 🌙 Runs daily at 2 AM UTC
- 💾 Stores backups in Cloud Storage
- 📧 (Optional) Email notifications on failure

**Time:** 5 minutes

---

## 📊 Monitoring Dashboard

### Admin Monitoring Page

**URL:** `http://localhost:3001/admin/monitoring`

**Features:**
- 🟢 Real-time PITR status
- 📈 Backup success/failure statistics
- ⏰ Last successful backup timestamp
- 🔴 Critical alerts if PITR disabled
- 🔘 One-click manual backup button

**Backup Health Indicators:**

| Status | PITR | Backups | Action Required |
|--------|------|---------|-----------------|
| 🟢 HEALTHY | ✅ Enabled | ✅ Recent backup | None |
| 🟡 WARNING | ✅ Enabled | ❌ No backups | Investigate backup failures |
| 🔴 CRITICAL | ❌ Disabled | Any | **ENABLE PITR IMMEDIATELY** |

---

## 🔧 API Endpoints

### POST `/api/admin/backup/trigger`

Trigger a manual backup.

**Request:**
```json
{
  "collections": ["users", "user_stats"],  // Optional: specific collections
  "reason": "Pre-deployment backup"        // Optional: reason for backup
}
```

**Response:**
```json
{
  "success": true,
  "backup": {
    "id": "manual_1696350000000_abc123",
    "status": "in_progress",
    "exportPath": "gs://moshimoshi-de237.firebasestorage.app/backups/manual/...",
    "startedAt": "2025-10-03T10:00:00.000Z",
    "collections": ["ALL"]
  },
  "message": "Backup initiated successfully. This may take several minutes."
}
```

---

### GET `/api/admin/backup/status`

Get current backup system status.

**Response:**
```json
{
  "success": true,
  "status": {
    "pitr": {
      "enabled": true,
      "earliestRestoreTime": "2025-09-26T10:00:00.000Z",
      "retentionDays": 7,
      "status": "ACTIVE"
    },
    "backups": {
      "total": 15,
      "successful": 14,
      "failed": 1,
      "inProgress": 0,
      "lastSuccessful": {
        "id": "scheduled_1696350000000",
        "timestamp": "2025-10-03T02:00:00.000Z",
        "type": "scheduled"
      }
    },
    "health": {
      "status": "HEALTHY",
      "message": "Backup system operational with PITR enabled"
    }
  }
}
```

---

### GET `/api/admin/backup/list`

Get paginated list of all backups.

**Query Parameters:**
- `limit` (number, default: 20, max: 100)
- `type` ('manual' | 'scheduled' | 'all', default: 'all')
- `status` ('completed' | 'failed' | 'in_progress' | 'all', default: 'all')

**Response:**
```json
{
  "success": true,
  "backups": [
    {
      "id": "manual_1696350000000_abc123",
      "type": "manual",
      "status": "completed",
      "triggeredBy": "admin@example.com",
      "reason": "Pre-deployment backup",
      "collections": ["ALL"],
      "exportPath": "gs://...",
      "startedAt": "2025-10-03T10:00:00.000Z",
      "completedAt": "2025-10-03T10:05:23.000Z",
      "duration": "5m 23s"
    }
  ],
  "summary": {
    "total": 15,
    "completed": 14,
    "failed": 1,
    "inProgress": 0,
    "manual": 5,
    "scheduled": 10
  }
}
```

---

## 🔐 Required Permissions

### Service Account Roles

Your Firebase service account needs:

1. **Datastore Import Export Admin** (`roles/datastore.importExportAdmin`)
   - Required for: Creating backups, PITR operations
   - Grant with:
     ```bash
     gcloud projects add-iam-policy-binding moshimoshi-de237 \
       --member="serviceAccount:moshimoshi-de237@appspot.gserviceaccount.com" \
       --role="roles/datastore.importExportAdmin"
     ```

2. **Storage Object Admin** (`roles/storage.objectAdmin`)
   - Required for: Writing backups to Cloud Storage
   - Grant with:
     ```bash
     gcloud projects add-iam-policy-binding moshimoshi-de237 \
       --member="serviceAccount:moshimoshi-de237@appspot.gserviceaccount.com" \
       --role="roles/storage.objectAdmin"
     ```

---

## 💾 Backup Storage

### Cloud Storage Structure

```
gs://moshimoshi-de237.firebasestorage.app/
└── backups/
    ├── manual/
    │   ├── manual_1696350000000_abc123/
    │   │   ├── all_namespaces/
    │   │   │   └── kind_*
    │   │   └── all_namespaces.export_metadata
    │   └── manual_1696351000000_def456/
    │       └── ...
    └── scheduled/
        ├── scheduled_1696302000000/
        │   └── ...
        └── scheduled_1696388400000/
            └── ...
```

### Backup Retention Policy

**Recommended:**
- PITR: 7 days (automatic, managed by Firebase)
- Manual backups: Keep indefinitely or 90 days
- Scheduled backups: Keep last 30 days

**Setup lifecycle policy:**
```bash
gsutil lifecycle set backup-lifecycle.json gs://moshimoshi-de237.firebasestorage.app/backups/
```

**backup-lifecycle.json:**
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 30,
          "matchesPrefix": ["backups/scheduled/"]
        }
      }
    ]
  }
}
```

---

## 🔄 Restore Procedures

### Option 1: Point-in-Time Recovery (Fastest)

**Use when:** You need to restore to a specific moment within the last 7 days

```bash
# Restore to specific timestamp
gcloud firestore databases restore \
  --source-backup=projects/moshimoshi-de237/databases/(default) \
  --restore-time="2025-10-02T14:30:00Z" \
  --destination-database="(default)"
```

**Time:** 5-15 minutes
**Downtime:** Required

---

### Option 2: Restore from Backup Export

**Use when:** Restoring from a specific manual or scheduled backup

```bash
# Import backup
gcloud firestore import gs://moshimoshi-de237.firebasestorage.app/backups/manual/manual_1696350000000_abc123/
```

**Time:** 10-60 minutes (depends on database size)
**Downtime:** Not required (can import to test database)

---

### Option 3: Partial Collection Restore

**Use when:** Only need to restore specific collections

```bash
gcloud firestore import \
  gs://moshimoshi-de237.firebasestorage.app/backups/manual/manual_1696350000000_abc123/ \
  --collection-ids=users,user_stats
```

---

## 📋 Backup History Tracking

All backups are logged to Firestore:

**Collection:** `backup_history`

**Document Structure:**
```typescript
{
  id: "manual_1696350000000_abc123",
  type: "manual" | "scheduled",
  status: "in_progress" | "completed" | "failed",
  triggeredBy: "admin@example.com",
  reason: "Pre-deployment backup",
  collections: ["ALL"] | ["users", "user_stats"],
  exportPath: "gs://...",
  startedAt: "2025-10-03T10:00:00.000Z",
  completedAt: "2025-10-03T10:05:23.000Z",
  error: null | "Error message"
}
```

---

## 🧪 Testing Backup & Restore

### Monthly Restore Test (Required!)

**Why:** Untested backups are worthless!

**Procedure:**
1. Create test Firebase project or database
2. Restore latest backup to test database
3. Verify data integrity
4. Document any issues

**Frequency:** First Monday of each month

---

## 💰 Cost Estimates

### PITR
- **Storage cost increase:** ~25%
- **Example:** $10/month storage → $12.50/month with PITR

### Backup Exports
- **Storage:** $0.026/GB/month (Cloud Storage)
- **Export operation:** Free
- **Import operation:** Free

**Estimated monthly cost for 10GB database:**
- PITR: $2.50 additional
- 30 daily backups × 10GB: $7.80
- **Total:** ~$10.30/month for comprehensive protection

---

## 🚨 Alerts & Monitoring

### Critical Alerts

1. **PITR Disabled**
   - Severity: CRITICAL
   - Action: Enable immediately
   - Dashboard: Shows red warning

2. **Backup Failed**
   - Severity: HIGH
   - Action: Investigate within 1 hour
   - Check: Error logs in `backup_history`

3. **No Recent Backup (>24 hours)**
   - Severity: MEDIUM
   - Action: Trigger manual backup
   - Verify: Scheduler job running

---

## 📚 Related Documentation

- [Firebase Collections Reference](/docs/firebase-collections/README.md)
- [Admin Dashboard Monitoring](/docs/firebase-collections/ADMIN_DASHBOARD_MONITORING.md)
- [API Collection Mapping](/docs/firebase-collections/API_TO_COLLECTION_MAP.md)

---

## 🆘 Troubleshooting

### "Permission Denied" Error

**Problem:** Backup fails with permission error

**Solution:**
```bash
# Grant required permissions
gcloud projects add-iam-policy-binding moshimoshi-de237 \
  --member="serviceAccount:moshimoshi-de237@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"
```

---

### Backup Takes Too Long

**Problem:** Backup exceeds 1 hour

**Solutions:**
- Reduce backup frequency (weekly instead of daily)
- Backup specific collections only
- Use PITR as primary protection, backups as secondary

---

### PITR Not Showing in Dashboard

**Problem:** PITR shows as disabled even after enabling

**Solutions:**
1. Wait 5-10 minutes for propagation
2. Verify with gcloud:
   ```bash
   gcloud firestore databases describe "(default)"
   ```
3. Check service account permissions

---

## ✅ Backup Checklist

- [ ] PITR enabled
- [ ] Manual backup tested from dashboard
- [ ] Automated backups scheduled
- [ ] Service account permissions granted
- [ ] Backup retention policy configured
- [ ] Restore procedure tested
- [ ] Monthly restore test scheduled
- [ ] Team trained on restore procedures
- [ ] Backup costs reviewed and approved

---

**Last Updated:** 2025-10-03
**Status:** ✅ Production Ready
**Maintainer:** DevOps Team
