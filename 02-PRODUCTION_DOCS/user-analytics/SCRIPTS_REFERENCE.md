# User Analytics Scripts Reference

**Status:** ACTIVE
**Last Updated:** 2026-02-01

This document provides detailed documentation for each user analytics script, including configuration options, output formats, and usage examples.

---

## Table of Contents

1. [check-new-users-by-date.js](#1-check-new-users-by-datejs)
2. [check-returning-users.js](#2-check-returning-usersjs)
3. [check-launch-retention.js](#3-check-launch-retentionjs)
4. [check-user-return-frequency.js](#4-check-user-return-frequencyjs)
5. [Common Patterns](#common-patterns)
6. [Creating New Scripts](#creating-new-scripts)

---

## 1. check-new-users-by-date.js

**Purpose:** Find all users who signed up on a specific date.

**Location:** `scripts/check-new-users-by-date.js`

### Configuration

```javascript
// Edit these variables to change the target date
const targetDate = new Date('2026-02-01T00:00:00.000Z');  // Start of day (UTC)
const nextDay = new Date('2026-02-02T00:00:00.000Z');     // End of day (UTC)
```

### Usage

```bash
node scripts/check-new-users-by-date.js
```

### Output Format

```
================================================================================
🔍 NEW USERS WHO SIGNED UP ON FEBRUARY 1ST, 2026
================================================================================

────────────────────────────────────────────────────────────────────────────────
👤 USER 1/9
────────────────────────────────────────────────────────────────────────────────
UID:          0Gbyd3GCe5gyuNQVO70Z6qvn0Oi2
Email:        user@example.com
Display Name: John Doe
Created At:   2026-02-01T00:29:21.604Z
Provider:     Unknown
Is Admin:     No
Photo URL:    https://...

💳 Subscription:
   Plan:   free
   Status: active

📊 Last Active: 2026-02-01T00:29:58.194Z
```

### Data Retrieved

| Field | Source | Description |
|-------|--------|-------------|
| UID | Document ID | Firebase user ID |
| Email | `users.email` | User's email address |
| Display Name | `users.displayName` | User's display name |
| Created At | `users.createdAt` | Signup timestamp |
| Provider | `users.provider` | Auth provider (Google, Apple, etc.) |
| Is Admin | `users.isAdmin` | Admin status |
| Subscription | `users.subscription` | Plan and status |
| Last Active | `users.lastActive` | Last activity timestamp |

---

## 2. check-returning-users.js

**Purpose:** Analyze which users from a specific cohort have returned after their initial session.

**Location:** `scripts/check-returning-users.js`

### Configuration

```javascript
// Signup date range to analyze
const SIGNUP_DATE_START = new Date('2026-02-01T00:00:00.000Z');
const SIGNUP_DATE_END = new Date('2026-02-02T00:00:00.000Z');

// Minimum time difference to consider a "return" (milliseconds)
// 1 hour = 3600000ms, 1 day = 86400000ms
const MIN_RETURN_GAP_MS = 3600000; // 1 hour
```

### Usage

```bash
node scripts/check-returning-users.js
```

### Output Format

```
================================================================================
✅ RETURNING USERS (1/9)
================================================================================

1. Josh (jshipleydev@gmail.com)
   Created:        2026-02-01T09:21:56.654Z
   Last Active:    2026-02-01T11:43:26.419Z
   Auth Last Sign: 2026-02-01T09:21:54.000Z
   Time since signup: 2.36 hours
   Plan: free

================================================================================
⏳ ONE-TIME USERS - Not Returned Yet (8/9)
================================================================================

1. Kaycee (oscar.th3.pup@gmail.com)
   Created:     2026-02-01T00:29:21.604Z
   Last Active: 2026-02-01T00:29:58.194Z
   Gap: 0.01 hours (less than 1h threshold)

================================================================================
📈 RETENTION SUMMARY
================================================================================
Total users signed up:    9
Returning users:          1 (11.1%)
One-time users:           8 (88.9%)
```

### How It Works

1. Queries `users` collection for signups in date range
2. For each user, calculates gap between `createdAt` and `lastActive`
3. Also checks Firebase Auth `lastSignInTime` vs `creationTime`
4. Uses the larger gap to determine if user has "returned"
5. Groups users into "returning" and "one-time" categories

---

## 3. check-launch-retention.js

**Purpose:** Comprehensive retention analysis since app launch (Jan 23, 2026).

**Location:** `scripts/check-launch-retention.js`

### Configuration

```javascript
const LAUNCH_DATE = new Date('2026-01-23T00:00:00.000Z');
const TODAY = new Date('2026-02-02T00:00:00.000Z');
const MIN_RETURN_GAP_MS = 86400000; // 24 hours
```

### Usage

```bash
node scripts/check-launch-retention.js
```

### Output Sections

#### Daily Cohort Breakdown
```
Date        | Signups | Returned | Not Returned | Retention | Premium
--------------------------------------------------------------------------------
2026-01-23  |    279 |      52 |         227 |    18.6% |      2
2026-01-24  |    120 |      20 |         100 |    16.7% |      0
```

#### Top 15 Most Engaged Users
Shows users with longest gap between signup and last activity.

#### Premium Subscribers
Lists all premium users with their retention status.

#### Overall Summary
```
Total signups since Jan 23:  636
Returned (24h+):             119 (18.9%)
Not returned:                517 (81.1%)
Premium subscribers:         2

Week 1 (Jan 23-29):          553 signups, 107 returned (19.3%)
```

---

## 4. check-user-return-frequency.js

**Purpose:** Analyze how many unique days each user has visited the app.

**Location:** `scripts/check-user-return-frequency.js`

### Configuration

```javascript
const LAUNCH_DATE = new Date('2026-01-23T00:00:00.000Z');
```

### Usage

```bash
node scripts/check-user-return-frequency.js
```

### Data Source

Uses `page_visits` collection to count unique days per user:

```javascript
// For each user, queries page_visits
const visitsSnapshot = await db.collection('page_visits')
  .where('userId', '==', userId)
  .get();

// Extracts unique dates from timestamps
const uniqueDays = new Set();
visitsSnapshot.forEach(doc => {
  const dateStr = new Date(doc.data().startedAt._seconds * 1000)
    .toISOString().split('T')[0];
  uniqueDays.add(dateStr);
});
```

### Output Sections

#### Top 20 Most Engaged Users
```
Rank | Days | Views | Signup     | Name (Email)
--------------------------------------------------------------------------------
   1 |    5 |    25 | 2026-01-28 | DimEl Japanese (dimeljapanese@gmail.com)
   2 |    4 |    11 | 2026-01-23 | Mikhail Zhilkin (jr55knndfb@...)
```

#### Return Frequency Distribution
```
0 days (no tracking):  448 users ( 70.4%) █████████████████████████
1 day only          :  136 users ( 21.4%) ██████████████
2 days              :   35 users (  5.5%) ████
3 days              :   10 users (  1.6%) █
4-5 days            :    7 users (  1.1%) █
```

#### Engagement Summary
```
Total users:           636
Multi-day users (2+):  52 (8.2%)
Regular users (5+):    1 (0.2%)
Super users (7+):      0 (0.0%)
```

#### Regular Users Visit Patterns
Shows exact dates visited for users with 5+ unique days.

### Important Notes

- **70% show 0 page visits** - This is expected as `page_visits` only captures certain navigation events
- For basic retention, use `lastActive` from user documents
- For detailed engagement, this script provides more granular data

---

## Common Patterns

### Firebase Admin Initialization

All scripts use the same initialization pattern:

```javascript
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();
```

### Date Range Queries

```javascript
const usersSnapshot = await db.collection('users')
  .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
  .where('createdAt', '<', admin.firestore.Timestamp.fromDate(endDate))
  .orderBy('createdAt', 'asc')
  .get();
```

### Timestamp Handling

Firestore timestamps need conversion:

```javascript
// From Firestore Timestamp to JavaScript Date
const createdAt = data.createdAt?.toDate?.();

// From raw seconds (in page_visits)
const date = new Date(data.startedAt._seconds * 1000);
```

---

## Creating New Scripts

### Template

```javascript
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 YOUR SCRIPT TITLE');
  console.log('='.repeat(80));

  try {
    // Your query logic here
    const snapshot = await db.collection('users').limit(10).get();

    snapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
```

### Best Practices

1. **Always exit the process** - Use `process.exit(0)` to avoid hanging
2. **Handle missing data** - Use optional chaining: `data.field?.toDate?.()`
3. **Show progress** - For long queries, show progress updates
4. **Use clear formatting** - Box drawing characters and emoji make output scannable
5. **Include summary stats** - Always end with a summary section

---

## Related Documentation

- [Admin Dashboard Guide](../admin-dashboard/DEVELOPER_GUIDE.md)
- [Firebase Monitoring](../admin-dashboard/METRICS_EXPLANATION.md)

---

*Last Updated: 2026-02-01*
