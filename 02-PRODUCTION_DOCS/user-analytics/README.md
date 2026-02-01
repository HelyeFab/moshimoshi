# User Analytics & Retention Scripts

**Status:** ACTIVE
**Last Updated:** 2026-02-01
**Launch Date:** January 23, 2026

## Overview

Collection of Firebase scripts for analyzing user signups, retention, and engagement patterns. These scripts connect directly to Firebase using the service account and provide insights into user behavior post-launch.

## Quick Start

```bash
# Navigate to project root
cd /path/to/moshimoshi

# Run any script
node scripts/check-new-users-by-date.js
node scripts/check-returning-users.js
node scripts/check-launch-retention.js
node scripts/check-user-return-frequency.js
```

**Requirements:**
- Node.js
- `moshimoshi-service-account.json` in project root
- Firebase Admin SDK (installed via npm)

---

## Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | This file - overview and quick start |
| [SCRIPTS_REFERENCE.md](./SCRIPTS_REFERENCE.md) | Detailed guide for each analytics script |

---

## Available Scripts

### 1. `check-new-users-by-date.js`
Find all users who signed up on a specific date.

```bash
node scripts/check-new-users-by-date.js
```

**Output:** List of users with email, name, signup time, subscription status.

**Configuration:** Edit the date variables at the top of the file:
```javascript
const targetDate = new Date('2026-02-01T00:00:00.000Z');
const nextDay = new Date('2026-02-02T00:00:00.000Z');
```

---

### 2. `check-returning-users.js`
Check which users from a specific signup cohort have returned after their initial session.

```bash
node scripts/check-returning-users.js
```

**Output:**
- Users who returned (active 1+ hours after signup)
- Users who haven't returned yet
- Retention percentage

**Configuration:**
```javascript
const SIGNUP_DATE_START = new Date('2026-02-01T00:00:00.000Z');
const SIGNUP_DATE_END = new Date('2026-02-02T00:00:00.000Z');
const MIN_RETURN_GAP_MS = 3600000; // 1 hour threshold
```

---

### 3. `check-launch-retention.js`
Comprehensive retention analysis since launch (Jan 23, 2026).

```bash
node scripts/check-launch-retention.js
```

**Output:**
- Daily cohort breakdown (signups, returned, retention %)
- Top 15 most engaged returning users
- Premium subscribers list
- Week-over-week comparison

**Sample Output:**
```
Date        | Signups | Returned | Retention | Premium
2026-01-23  |    279 |      52 |    18.6% |      2
2026-01-24  |    120 |      20 |    16.7% |      0
```

---

### 4. `check-user-return-frequency.js`
Analyze how many **unique days** each user has visited the app.

```bash
node scripts/check-user-return-frequency.js
```

**Output:**
- Top 20 most engaged users (by days visited)
- Distribution chart (1 day, 2 days, 3 days, etc.)
- Multi-day user count
- Visit patterns for regular users (5+ days)

**Sample Output:**
```
📊 RETURN FREQUENCY DISTRIBUTION
0 days (no tracking):  448 users ( 70.4%)
1 day only          :  136 users ( 21.4%)
2 days              :   35 users (  5.5%)
3 days              :   10 users (  1.6%)
4-5 days            :    7 users (  1.1%)
```

---

## Key Metrics Explained

### Retention Rate (Day-1)
Percentage of users who were active 24+ hours after their signup.

**Formula:** `(Users with lastActive - createdAt >= 24h) / Total Users × 100`

**Current Benchmark (Jan 23 - Feb 1):** ~18-19%

---

### Multi-Day Users
Users who have visited the app on 2 or more unique calendar days.

**Current Benchmark:** 8.2% of users

---

### Return Frequency
Number of unique days a user has page visits recorded.

**Data Source:** `page_visits` collection in Firestore

**Note:** 70% of users show 0 page visits - this may indicate:
- They signed up but didn't browse while logged in
- Page tracking wasn't capturing their sessions
- They only used features that don't trigger page visit tracking

---

## Data Sources

### Firestore Collections Used

| Collection | Fields Used | Purpose |
|------------|-------------|---------|
| `users` | `createdAt`, `lastActive`, `email`, `displayName`, `subscription` | User profiles and activity timestamps |
| `page_visits` | `userId`, `startedAt`, `path` | Page view tracking for return frequency |

### Firebase Auth
- `creationTime` - Account creation timestamp
- `lastSignInTime` - Last authentication event

---

## Key Findings (Post-Launch)

### Launch Summary (Jan 23 - Feb 1, 2026)
- **Total signups:** 636 users
- **Launch day (Jan 23):** 279 signups (44% of total)
- **Day-1 Retention:** 18.9%
- **Multi-day users:** 52 (8.2%)
- **Premium subscribers:** 2

### Cohort Retention by Signup Date
| Date | Signups | Retention |
|------|---------|-----------|
| Jan 23 (Launch) | 279 | 18.6% |
| Jan 24 | 120 | 16.7% |
| Jan 25 | 74 | 12.2% |
| Jan 26 | 29 | 24.1% |
| Jan 27 | 31 | 32.3% |
| Jan 28 | 31 | 25.8% |
| Jan 29 | 19 | 47.4% |

**Insight:** Smaller cohorts (organic signups) show higher retention than launch-day traffic.

---

## Related Files

### Scripts
- `scripts/check-new-users-by-date.js` - Query users by signup date
- `scripts/check-returning-users.js` - Check return status for cohort
- `scripts/check-launch-retention.js` - Post-launch retention analysis
- `scripts/check-user-return-frequency.js` - Multi-day visit analysis
- `scripts/check-january-retention.js` - January-specific retention
- `scripts/view-user-data.js` - View single user's complete data

### Admin Dashboard
- `src/app/[locale]/admin/page.tsx` - Dashboard with user stats
- `src/app/api/admin/stats/route.ts` - Stats API endpoint
- `src/app/[locale]/admin/user-lookup/page.tsx` - User lookup tool

### Tracking System
- `src/lib/analytics/pageVisitTracker.ts` - Page visit tracking logic
- `src/app/api/analytics/page-visit/route.ts` - Page visit API

---

## Future Improvements

1. **Add login count tracking** - Currently we only track `lastActive`, not a counter
2. **Cohort analysis automation** - Weekly retention reports
3. **Feature engagement tracking** - What features do returning users use?
4. **Churn prediction** - Identify users likely to churn
5. **Real-time dashboard** - Live retention metrics in admin

---

## Troubleshooting

### Script fails with "Cannot find module"
```bash
npm install firebase-admin
```

### "Permission denied" errors
Ensure `moshimoshi-service-account.json` exists in project root and has correct permissions.

### "0 page visits" for most users
This is expected - page_visits only tracks certain navigation events. Use `lastActive` from user documents for basic retention.

---

*Created: 2026-02-01*
