# Admin Dashboard Monitoring & Backup Strategy

## Overview
Comprehensive monitoring strategy for the Moshimoshi admin dashboard with automated backups, alerts, and health metrics.

---

## 🔥 Critical Metrics to Monitor (Red Alerts)

### 1. System Health
**Collection:** N/A (System-level)

**Metrics:**
- ✅ **Firebase Firestore Status** - API availability (99.95% SLA)
- ✅ **Firebase Storage Status** - Storage availability
- ✅ **Error Rate** - 5xx errors per minute
- ✅ **Response Time** - P95 latency > 1000ms
- ✅ **API Quota** - Firestore read/write quota usage

**Alert Thresholds:**
- Error rate > 5% (5 minutes)
- Response time P95 > 2000ms (5 minutes)
- API quota > 80% of daily limit

**Dashboard Widget:**
```typescript
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical'
  errorRate: number              // Percentage
  avgResponseTime: number        // ms
  p95ResponseTime: number        // ms
  quotaUsage: {
    reads: { used: number, limit: number, percentage: number }
    writes: { used: number, limit: number, percentage: number }
    deletes: { used: number, limit: number, percentage: number }
  }
  lastCheck: string              // ISO timestamp
}
```

---

### 2. User Growth & Churn
**Collections:** `users`, `user_stats`

**Metrics:**
- 📊 **Total Users** - All registered users
- 📊 **New Users (24h)** - Sign-ups in last 24 hours
- 📊 **Active Users (7d)** - Users active in last 7 days
- 📊 **Active Users (30d)** - Users active in last 30 days
- 📊 **Churn Rate** - Users who haven't returned in 30 days
- 📊 **Premium Conversion Rate** - Free → Premium conversion
- 📊 **User Tier Distribution** - Guest/Free/Premium breakdown

**Alert Thresholds:**
- Churn rate > 50% (weekly check)
- New user signups < 10/day (daily check)
- Premium conversion rate < 2% (weekly check)

**Dashboard Widget:**
```typescript
interface UserGrowth {
  total: number
  new24h: number
  active7d: number
  active30d: number
  churnRate: number              // Percentage
  conversionRate: number         // Percentage
  tierDistribution: {
    guest: number
    free: number
    premium_monthly: number
    premium_yearly: number
  }
  growth: {
    daily: number                // % change
    weekly: number               // % change
    monthly: number              // % change
  }
}
```

**Query:**
```typescript
// Get user growth stats
const now = new Date()
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

const totalUsers = await adminDb.collection('users').count().get()
const new24h = await adminDb.collection('users')
  .where('createdAt', '>=', yesterday)
  .count().get()

const active7d = await adminDb.collection('user_stats')
  .where('dates.lastActivityDate', '>=', weekAgo.toISOString())
  .count().get()
```

---

### 3. Revenue Metrics
**Collections:** `users` (subscription data), `stripe`

**Metrics:**
- 💰 **MRR (Monthly Recurring Revenue)** - Normalized monthly revenue
- 💰 **ARR (Annual Recurring Revenue)** - MRR × 12
- 💰 **Active Subscriptions** - Current paying customers
- 💰 **Subscription Status Breakdown** - Active/Past Due/Canceled
- 💰 **Cancellation Rate** - Subscriptions canceled (30d)
- 💰 **Average Revenue Per User (ARPU)**
- 💰 **Lifetime Value (LTV)** - Estimated customer lifetime value

**Alert Thresholds:**
- MRR decrease > 10% (monthly check)
- Cancellation rate > 5% (weekly check)
- Past due subscriptions > 10 (daily check)

**Dashboard Widget:**
```typescript
interface RevenueMetrics {
  mrr: number                    // USD
  arr: number                    // USD
  activeSubscriptions: number
  subscriptionStatus: {
    active: number
    trialing: number
    past_due: number
    canceled: number
  }
  cancellationRate: number       // Percentage
  arpu: number                   // USD
  ltv: number                    // USD
  revenueGrowth: {
    mom: number                  // Month-over-month %
    qoq: number                  // Quarter-over-quarter %
  }
}
```

**Query:**
```typescript
// Calculate MRR
const subscriptions = await adminDb.collection('users')
  .where('subscription.status', '==', 'active')
  .get()

let mrr = 0
subscriptions.docs.forEach(doc => {
  const sub = doc.data().subscription
  if (sub.plan === 'premium_monthly') {
    mrr += 8.99
  } else if (sub.plan === 'premium_yearly') {
    mrr += 99.99 / 12
  }
})
```

---

### 4. Feature Usage & Engagement
**Collections:** `usage`, `user_stats`, `drill_sessions`

**Metrics:**
- 🎯 **Daily Active Features** - Which features are being used
- 🎯 **Feature Adoption Rate** - % of users using each feature
- 🎯 **Average Session Duration** - Time spent per session
- 🎯 **Sessions per User** - Engagement frequency
- 🎯 **Feature Usage Trends** - Week-over-week changes
- 🎯 **Drill Completion Rate** - % of started drills completed
- 🎯 **Review Accuracy** - Average review accuracy

**Alert Thresholds:**
- Feature adoption < 5% for new features (30 days after launch)
- Average session duration < 5 minutes (weekly check)
- Drill completion rate < 50% (weekly check)

**Dashboard Widget:**
```typescript
interface FeatureUsage {
  topFeatures: Array<{
    featureId: string
    name: string
    usageCount: number
    adoptionRate: number         // Percentage
    trend: number                // % change week-over-week
  }>
  engagement: {
    avgSessionDuration: number   // minutes
    sessionsPerUser: number
    drillCompletionRate: number  // Percentage
    reviewAccuracy: number       // Percentage
  }
  usageByTier: {
    free: number
    premium: number
  }
}
```

**Query:**
```typescript
// Get top features by usage
const today = new Date().toISOString().split('T')[0]
const usageSnapshot = await adminDb
  .collection('usage')
  .get()

const featureCounts = new Map<string, number>()
usageSnapshot.docs.forEach(doc => {
  const data = doc.data()
  Object.keys(data).forEach(key => {
    if (key.includes('_') && typeof data[key] === 'number') {
      const featureId = key.split('_')[0]
      featureCounts.set(featureId, (featureCounts.get(featureId) || 0) + data[key])
    }
  })
})
```

---

### 5. Quota & Resource Usage
**Collections:** `usage`, system metrics

**Metrics:**
- 📈 **Firestore Reads** - Daily/hourly read operations
- 📈 **Firestore Writes** - Daily/hourly write operations
- 📈 **Storage Usage** - Total Firebase Storage used
- 📈 **TTS Cache Size** - TTS cache storage
- 📈 **TTS Cache Hit Rate** - Cache efficiency
- 📈 **Bandwidth Usage** - Data transfer (GB)
- 📈 **Cloud Function Executions** - Function invocations

**Alert Thresholds:**
- Firestore reads > 80% daily quota
- Storage usage > 90% of plan limit
- TTS cache hit rate < 70%
- Unexpected spike in operations (2x normal)

**Dashboard Widget:**
```typescript
interface ResourceUsage {
  firestore: {
    reads: { today: number, quota: number, percentage: number }
    writes: { today: number, quota: number, percentage: number }
    deletes: { today: number, quota: number, percentage: number }
  }
  storage: {
    used: number                 // GB
    limit: number                // GB
    percentage: number
    breakdown: {
      tts: number
      avatars: number
      resources: number
    }
  }
  tts: {
    cacheSize: number            // GB
    hitRate: number              // Percentage
    requestsToday: number
    costSavings: number          // USD
  }
  bandwidth: {
    today: number                // GB
    month: number                // GB
  }
}
```

---

### 6. Error Monitoring & Health
**Collections:** `admin_logs`, application logs

**Metrics:**
- ⚠️ **Error Count (24h)** - Total errors in last 24 hours
- ⚠️ **Error Types** - Breakdown by error category
- ⚠️ **Failed API Requests** - API errors per endpoint
- ⚠️ **Failed Webhooks** - Stripe webhook failures
- ⚠️ **Failed Notifications** - Email/push failures
- ⚠️ **Database Operation Failures** - Failed reads/writes
- ⚠️ **Critical Error Rate** - 5xx errors vs. 4xx errors

**Alert Thresholds:**
- Error count > 100 in 1 hour
- Critical error rate > 1%
- Failed webhook > 5 in 1 hour
- Failed notification > 10%

**Dashboard Widget:**
```typescript
interface ErrorMonitoring {
  total24h: number
  errorsByType: {
    authentication: number
    validation: number
    database: number
    api: number
    webhook: number
    notification: number
  }
  criticalErrors: Array<{
    timestamp: string
    type: string
    message: string
    endpoint: string
    userId?: string
  }>
  errorRate: {
    current: number              // Percentage
    avg24h: number               // Percentage
    spike: boolean               // Is there a spike?
  }
  affectedUsers: number          // Users experiencing errors
}
```

---

### 7. Content Health
**Collections:** `blog`, `resources`, `news`, `youtube_series`

**Metrics:**
- 📝 **Total Blog Posts** - Published posts
- 📝 **Total Resources** - Available resources
- 📝 **News Articles** - Current news count
- 📝 **Content Freshness** - Last published date
- 📝 **Draft Content** - Unpublished drafts
- 📝 **Most Viewed Content** - Top performers
- 📝 **Content Engagement** - Views/Downloads per item

**Alert Thresholds:**
- No new content published in 7 days
- News articles older than 30 days
- > 20 draft posts (cleanup needed)

**Dashboard Widget:**
```typescript
interface ContentHealth {
  counts: {
    blogPosts: number
    resources: number
    newsArticles: number
    videoSeries: number
  }
  freshness: {
    lastBlogPost: string         // ISO date
    lastResource: string
    lastNews: string
    daysSinceLastPublish: number
  }
  engagement: {
    totalViews: number
    totalDownloads: number
    avgViewsPerPost: number
    topContent: Array<{
      id: string
      title: string
      type: string
      views: number
    }>
  }
  drafts: number
}
```

---

### 8. Data Integrity & Consistency
**Collections:** All collections

**Metrics:**
- 🔍 **Orphaned Records** - Records without parent (e.g., sessions without users)
- 🔍 **Data Schema Violations** - Documents missing required fields
- 🔍 **Duplicate Records** - Potential duplicates
- 🔍 **Corrupted Data** - Invalid data formats
- 🔍 **Sync Failures** - IndexedDB → Firebase sync failures
- 🔍 **Missing Indexes** - Queries requiring composite indexes

**Alert Thresholds:**
- Orphaned records > 100
- Schema violations > 50
- Sync failures > 5%

**Dashboard Widget:**
```typescript
interface DataIntegrity {
  checks: Array<{
    name: string
    status: 'pass' | 'warning' | 'fail'
    issueCount: number
    lastCheck: string
  }>
  orphanedRecords: {
    sessions: number
    progress: number
    srsData: number
  }
  schemaViolations: {
    collection: string
    count: number
    examples: Array<{ id: string, issue: string }>
  }[]
  syncHealth: {
    successRate: number          // Percentage
    failedSyncs: number
    lastSuccessfulSync: string
  }
}
```

---

### 9. Performance Metrics
**Collections:** N/A (application metrics)

**Metrics:**
- ⚡ **API Response Times** - P50, P95, P99 latencies
- ⚡ **Database Query Performance** - Slow queries (>1s)
- ⚡ **Page Load Times** - Frontend performance
- ⚡ **TTS Generation Time** - Audio synthesis latency
- ⚡ **Review Engine Performance** - SRS calculation time
- ⚡ **Cache Performance** - Hit rates for all caches

**Alert Thresholds:**
- P95 response time > 2000ms
- Slow query count > 50/hour
- Page load time > 3s

**Dashboard Widget:**
```typescript
interface PerformanceMetrics {
  api: {
    p50: number                  // ms
    p95: number                  // ms
    p99: number                  // ms
    slowestEndpoints: Array<{
      endpoint: string
      avgTime: number
      count: number
    }>
  }
  database: {
    avgQueryTime: number         // ms
    slowQueries: number
    indexUsage: number           // Percentage
  }
  frontend: {
    avgPageLoad: number          // ms
    firstContentfulPaint: number // ms
    timeToInteractive: number    // ms
  }
  caching: {
    ttsHitRate: number           // Percentage
    apiCacheHitRate: number      // Percentage
    redisHitRate: number         // Percentage
  }
}
```

---

### 10. Security & Compliance
**Collections:** `admin_logs`, `notification_unsubscribes`, `users`

**Metrics:**
- 🔒 **Admin Actions** - Recent admin operations
- 🔒 **Failed Login Attempts** - Potential security threats
- 🔒 **Suspicious Activity** - Unusual usage patterns
- 🔒 **Data Export Requests** - GDPR requests
- 🔒 **Account Deletions** - User churn via deletion
- 🔒 **Unsubscribe Rate** - Email opt-outs
- 🔒 **Security Events** - IP blocks, rate limits hit

**Alert Thresholds:**
- Failed login attempts > 10 from same IP
- Admin actions by unknown admin
- Data export requests > 5/day (unusual)

**Dashboard Widget:**
```typescript
interface SecurityMetrics {
  adminActivity: {
    actionsToday: number
    recentActions: Array<{
      timestamp: string
      admin: string
      action: string
      target: string
    }>
  }
  threats: {
    failedLogins: number
    suspiciousIPs: string[]
    rateLimitHits: number
  }
  compliance: {
    dataExportRequests: number
    accountDeletions: number
    unsubscribeRate: number      // Percentage
  }
  userSafety: {
    bannedUsers: number
    reportedContent: number
    moderationQueue: number
  }
}
```

---

## 💾 Database Backup Strategy

### Automated Backups

#### 1. Firestore Managed Exports (Recommended)
**What:** Firebase's built-in automated export feature
**Where:** Cloud Storage bucket
**Frequency:** Daily at 2 AM UTC
**Retention:** 30 days rolling

**Setup:**
```bash
# Enable Firestore managed exports
gcloud firestore export gs://moshimoshi-backups/daily/$(date +%Y%m%d) \
  --async

# Schedule with Cloud Scheduler
gcloud scheduler jobs create http firestore-daily-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/moshimoshi-de237/databases/(default):exportDocuments" \
  --message-body='{"outputUriPrefix":"gs://moshimoshi-backups/daily"}' \
  --oauth-service-account-email=firebase-adminsdk-fbsvc@moshimoshi-de237.iam.gserviceaccount.com
```

**Cost:** ~$0.026 per GB exported, ~$0.02 per GB stored/month

---

#### 2. Collection-Level Backups
**What:** Export specific collections programmatically
**Frequency:** Hourly for critical collections
**Retention:** 7 days

**Critical Collections to Backup Hourly:**
- `users` - User profiles and subscriptions
- `user_stats` - User progress and gamification
- `stripe` - Payment mappings

**Implementation:**
```typescript
// Firebase Cloud Function
import { storage } from 'firebase-admin'
import { firestore } from 'firebase-admin'

export const hourlyBackup = functions.pubsub
  .schedule('0 * * * *')  // Every hour
  .onRun(async (context) => {
    const collections = ['users', 'user_stats', 'stripe']
    const bucket = storage().bucket('moshimoshi-backups')
    const timestamp = new Date().toISOString()

    for (const collectionName of collections) {
      const snapshot = await firestore().collection(collectionName).get()
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      const fileName = `hourly/${collectionName}/${timestamp}.json`
      await bucket.file(fileName).save(JSON.stringify(data, null, 2))
    }
  })
```

---

#### 3. Point-in-Time Recovery
**What:** Enable point-in-time recovery (PITR) for Firestore
**Retention:** 7 days of continuous backup
**Recovery:** Restore to any point in the last 7 days

**Setup:**
```bash
# Enable PITR
gcloud firestore databases update (default) \
  --enable-point-in-time-recovery

# PITR is included in Firestore pricing
# Recovery is done via Support Console
```

---

### Manual Backup Options

#### Admin Dashboard Backup Button
**Implementation:**

```typescript
// API Route: /api/admin/backup/trigger
export async function POST(req: Request) {
  const session = await getSession()

  // Check admin
  if (!(await isAdminUser(session.uid))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { collections, format } = await req.json()

  // Trigger Cloud Function to export
  const backupId = `manual_${Date.now()}`
  const exportPath = `gs://moshimoshi-backups/manual/${backupId}`

  // Use Firestore export API
  await adminDb.exportDocuments({
    outputUriPrefix: exportPath,
    collectionIds: collections || undefined  // All if not specified
  })

  // Log the backup
  await adminDb.collection('admin_logs').add({
    action: 'database.backup.manual',
    adminId: session.uid,
    details: { backupId, collections, exportPath },
    timestamp: FieldValue.serverTimestamp()
  })

  return NextResponse.json({
    success: true,
    backupId,
    exportPath,
    estimatedTime: '5-30 minutes depending on size'
  })
}
```

**Dashboard UI:**
```typescript
// Backup trigger component
<Card>
  <CardHeader>
    <CardTitle>Database Backup</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div>
        <Label>Backup Type</Label>
        <Select value={backupType} onValueChange={setBackupType}>
          <SelectItem value="full">Full Database</SelectItem>
          <SelectItem value="users">Users Only</SelectItem>
          <SelectItem value="critical">Critical Collections</SelectItem>
          <SelectItem value="custom">Custom Selection</SelectItem>
        </Select>
      </div>

      <Button onClick={triggerBackup} disabled={backing Up}>
        {backingUp ? 'Creating Backup...' : 'Create Backup Now'}
      </Button>

      <div className="text-sm text-muted-foreground">
        Last backup: {lastBackup}
      </div>
    </div>
  </CardContent>
</Card>
```

---

### Backup Download & Restore

#### Download Backups
```typescript
// API Route: /api/admin/backup/download
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const backupId = searchParams.get('backupId')

  // Generate signed URL for download
  const bucket = storage().bucket('moshimoshi-backups')
  const [url] = await bucket
    .file(`manual/${backupId}/all_namespaces.overall_export_metadata`)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000  // 1 hour
    })

  return NextResponse.json({ downloadUrl: url })
}
```

#### Restore from Backup
```typescript
// API Route: /api/admin/backup/restore
export async function POST(req: Request) {
  const { backupId, targetDate } = await req.json()

  // IMPORTANT: This is destructive!
  // Implement with extreme caution and confirmation

  const importPath = `gs://moshimoshi-backups/manual/${backupId}`

  // Use Firestore import API
  await adminDb.importDocuments({
    inputUriPrefix: importPath,
    collectionIds: undefined  // All collections
  })

  // Log the restore
  await adminDb.collection('admin_logs').add({
    action: 'database.restore',
    adminId: session.uid,
    details: { backupId, importPath },
    timestamp: FieldValue.serverTimestamp(),
    severity: 'critical'
  })

  return NextResponse.json({ success: true })
}
```

---

## 📊 Recommended Dashboard Layout

### Top Row - Health Overview
```
┌─────────────────────────────────────────────────────────────────┐
│  System Health   │  Active Users  │  MRR  │  Error Rate │  CPU  │
│  🟢 Healthy      │  1,234         │ $8.9K │  0.12%      │  45%  │
└─────────────────────────────────────────────────────────────────┘
```

### Main Dashboard Sections
1. **Overview** (default view)
   - System health cards
   - Key metrics (users, revenue, engagement)
   - Recent alerts
   - Quick actions (backup, export)

2. **Users** tab
   - User growth chart
   - Tier distribution
   - Churn analysis
   - User list with filters

3. **Revenue** tab
   - MRR/ARR charts
   - Subscription breakdown
   - Cancellation trends
   - Stripe integration status

4. **Engagement** tab
   - Feature usage heatmap
   - Session analytics
   - Content performance
   - User journey flow

5. **System** tab
   - Resource usage graphs
   - API performance
   - Error logs
   - Database metrics

6. **Content** tab
   - Content inventory
   - Publishing schedule
   - Engagement metrics
   - Content health

7. **Security** tab
   - Admin activity log
   - Failed login attempts
   - GDPR requests
   - Compliance status

8. **Backups** tab
   - Backup history
   - Scheduled backups
   - Manual backup trigger
   - Restore options

---

## 🚨 Alert Configuration

### Email Alerts (Critical)
- System down or degraded
- Error rate spike (> 5%)
- Revenue drop (> 10% MRR)
- Failed Stripe webhooks
- Database quota exceeded

### Slack/Discord Alerts (Important)
- New user milestones (100, 1000, 10000)
- Revenue milestones ($1K, $10K MRR)
- Feature usage anomalies
- Security events
- Backup failures

### Dashboard Notifications (Info)
- Daily summary report
- Weekly metrics report
- Content publishing reminders
- Low resource warnings

---

## 📈 Monitoring Tools Integration

### Recommended Stack
1. **Firebase Console** - Built-in metrics
2. **Google Cloud Monitoring** - Infrastructure metrics
3. **Sentry** - Error tracking (already integrated?)
4. **PostHog/Mixpanel** - Product analytics
5. **Better Uptime** - Uptime monitoring
6. **Grafana** - Custom dashboards (optional)

---

## 🔄 Implementation Priority

### Phase 1 (Week 1) - Critical
- ✅ System health monitoring
- ✅ User growth metrics
- ✅ Revenue metrics
- ✅ Automated daily backups
- ✅ Error monitoring

### Phase 2 (Week 2) - Important
- ✅ Feature usage analytics
- ✅ Resource quota monitoring
- ✅ Manual backup trigger
- ✅ Alert configuration
- ✅ Email notifications

### Phase 3 (Week 3) - Nice-to-have
- ✅ Content health metrics
- ✅ Performance monitoring
- ✅ Data integrity checks
- ✅ Security monitoring
- ✅ Point-in-time recovery

---

## 💡 Best Practices

1. **Monitor trends, not just numbers** - Week-over-week, month-over-month
2. **Set realistic alert thresholds** - Avoid alert fatigue
3. **Test backup restoration** - Monthly restore test to separate environment
4. **Document runbooks** - Step-by-step guides for common issues
5. **Regular backup audits** - Verify backups are complete and restorable
6. **Automate everything** - Backups, alerts, reports
7. **Keep historical data** - Aggregate metrics for trend analysis
8. **Security first** - Encrypt backups, limit admin access
