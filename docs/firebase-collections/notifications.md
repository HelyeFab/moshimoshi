# Notifications - Firebase Collections

## Overview
User notification preferences and pending notification queue for email and push notifications.

## Collections

### `users/{userId}/notification_preferences`

**Description:** User notification settings and preferences.

**Access:**
- ✅ All authenticated users (own preferences only)
- 📍 Location: Subcollection under user document
- 🔄 Updated by: User settings page

**Document Structure:**

```typescript
{
  // Email notifications
  email: {
    enabled: boolean                  // Master email toggle
    dailyReminder: boolean            // Daily study reminder
    weeklyProgress: boolean           // Weekly progress report
    achievements: boolean             // Achievement unlocks
    streakReminder: boolean           // Streak about to break
    newFeatures: boolean              // New feature announcements
    promotions: boolean               // Promotional emails
  }

  // Push notifications (future feature)
  push: {
    enabled: boolean                  // Master push toggle
    dailyReminder: boolean            // Daily study reminder
    reviewsDue: boolean               // Reviews due notification
    achievements: boolean             // Achievement unlocks
    streakReminder: boolean           // Streak warning
  }

  // Notification timing
  timing: {
    dailyReminderTime: string         // HH:MM format (e.g., "09:00")
    timezone: string                  // IANA timezone (e.g., "America/New_York")
    weeklyReportDay: number           // Day of week (0-6, 0 = Sunday)
  }

  // Metadata
  updatedAt: Timestamp                // Last update
  createdAt: Timestamp                // When preferences created
}
```

**Example Document:**

```json
{
  "email": {
    "enabled": true,
    "dailyReminder": true,
    "weeklyProgress": true,
    "achievements": true,
    "streakReminder": true,
    "newFeatures": false,
    "promotions": false
  },
  "push": {
    "enabled": false,
    "dailyReminder": false,
    "reviewsDue": false,
    "achievements": false,
    "streakReminder": false
  },
  "timing": {
    "dailyReminderTime": "09:00",
    "timezone": "America/New_York",
    "weeklyReportDay": 1
  },
  "updatedAt": "2025-10-03T14:30:00.000Z",
  "createdAt": "2025-09-01T10:00:00.000Z"
}
```

**Firestore Path Example:**
```
users/8onZzlQg3tQxkw8pinSF9ow4Q6j2/notification_preferences/preferences
```

---

### `notification_queue` (Top-Level)

**Description:** Pending notifications to be sent by scheduled functions.

**Access:**
- 🔒 System-only (Firebase Functions)
- 📍 Location: Top-level collection
- 🔄 Created by: Notification scheduling system

**Document Structure:**

```typescript
{
  // Recipient
  userId: string                      // Target user ID
  email?: string                      // User's email address

  // Notification details
  type: 'daily_reminder' | 'weekly_progress' | 'achievement' | 'streak_warning'
  channel: 'email' | 'push'

  // Email-specific
  template: string                    // Email template ID
  subject: string                     // Email subject
  data: object                        // Template variables

  // Scheduling
  scheduledFor: Timestamp             // When to send
  status: 'pending' | 'sent' | 'failed' | 'canceled'

  // Execution tracking
  sentAt?: Timestamp                  // When actually sent
  failureReason?: string              // Error message if failed
  retryCount: number                  // Number of retry attempts
  maxRetries: number                  // Max retry attempts (default: 3)

  // Metadata
  createdAt: Timestamp                // When queued
  updatedAt: Timestamp                // Last status update
}
```

**Example Document:**

```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "email": "user@example.com",
  "type": "daily_reminder",
  "channel": "email",
  "template": "daily-reminder-v2",
  "subject": "Time for your Japanese lesson! 🎌",
  "data": {
    "userName": "John",
    "streak": 7,
    "dueReviews": 12,
    "dashboardUrl": "https://moshimoshi.app/dashboard"
  },
  "scheduledFor": "2025-10-04T09:00:00.000Z",
  "status": "pending",
  "retryCount": 0,
  "maxRetries": 3,
  "createdAt": "2025-10-03T20:00:00.000Z",
  "updatedAt": "2025-10-03T20:00:00.000Z"
}
```

**Firestore Path Example:**
```
notification_queue/notif-abc123def456
```

---

### `notification_unsubscribes` (Top-Level)

**Description:** Tracks unsubscribed email addresses for compliance.

**Access:**
- 🔒 System-only
- 📍 Location: Top-level collection
- 🔄 Created by: Unsubscribe endpoint

**Document Structure:**

```typescript
{
  email: string                       // Unsubscribed email address
  userId?: string                     // User ID (if available)
  unsubscribedAt: Timestamp           // When unsubscribed
  reason?: string                     // Unsubscribe reason
  source: 'user_settings' | 'email_link' | 'admin'
}
```

**Example Document:**

```json
{
  "email": "user@example.com",
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "unsubscribedAt": "2025-10-03T14:30:00.000Z",
  "reason": "Too many emails",
  "source": "email_link"
}
```

**Firestore Path Example:**
```
notification_unsubscribes/user@example.com
```

## Notification Types

### Daily Reminder
- **Type:** `daily_reminder`
- **Trigger:** Scheduled daily at user's preferred time
- **Condition:** User has reviews due OR hasn't studied today
- **Template:** Personalized with streak, due reviews, daily goal

### Weekly Progress
- **Type:** `weekly_progress`
- **Trigger:** Scheduled weekly (default: Monday)
- **Content:** Week summary, XP gained, achievements unlocked
- **Template:** Progress charts, encouragement, upcoming goals

### Achievement Unlocked
- **Type:** `achievement`
- **Trigger:** Real-time when achievement unlocked
- **Content:** Achievement details, next milestone
- **Template:** Celebration message with badge image

### Streak Warning
- **Type:** `streak_warning`
- **Trigger:** Scheduled if user hasn't studied by 8 PM local time
- **Condition:** Current streak ≥ 3 days
- **Template:** Motivational message to maintain streak

## API Endpoints

### GET `/api/notifications/preferences`
Get user's notification preferences

**Auth:** Required

**Response:**
```json
{
  "email": {
    "enabled": true,
    "dailyReminder": true,
    "weeklyProgress": true
  },
  "push": {
    "enabled": false
  },
  "timing": {
    "dailyReminderTime": "09:00",
    "timezone": "America/New_York"
  }
}
```

**File:** `/src/app/api/notifications/preferences/route.ts`

---

### PUT `/api/notifications/preferences`
Update notification preferences

**Auth:** Required

**Request:**
```json
{
  "email": {
    "dailyReminder": false,
    "achievements": true
  },
  "timing": {
    "dailyReminderTime": "10:00"
  }
}
```

**Response:**
```json
{
  "success": true,
  "preferences": { /* updated preferences */ }
}
```

**File:** `/src/app/api/notifications/preferences/route.ts`

---

### POST `/api/notifications/unsubscribe`
Unsubscribe from all emails

**Auth:** Optional (can use email token)

**Request:**
```json
{
  "email": "user@example.com",
  "token": "unsubscribe-token-abc123",
  "reason": "Too many emails"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully unsubscribed"
}
```

**File:** `/src/app/api/notifications/unsubscribe/route.ts`

---

### POST `/api/notifications/test`
Send test notification (admin only)

**Auth:** Required (Admin)

**Request:**
```json
{
  "userId": "8onZzlQg3tQxkw8pinSF9ow4Q6j2",
  "type": "daily_reminder"
}
```

**Response:**
```json
{
  "success": true,
  "queued": true,
  "notificationId": "notif-abc123"
}
```

**File:** `/src/app/api/notifications/test/route.ts`

---

### GET `/api/notifications/pending`
Get pending notifications (admin only)

**Auth:** Required (Admin)

**Query Params:**
- `userId` - Filter by user
- `status` - Filter by status (pending, sent, failed)
- `limit` - Limit results (default: 100)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif-abc123",
      "userId": "...",
      "type": "daily_reminder",
      "status": "pending",
      "scheduledFor": "...",
      "createdAt": "..."
    }
  ],
  "total": 456
}
```

**File:** `/src/app/api/notifications/pending/route.ts`

## Firebase Functions

### Scheduled: Daily Reminder
**Trigger:** Every hour (checks if any user needs reminder)

**Logic:**
1. Query users with `dailyReminder` enabled
2. Check user's local time
3. If time matches preference AND hasn't studied today
4. Queue notification in `notification_queue`

**Function:** `scheduleDailyReminders()`

---

### Scheduled: Weekly Progress
**Trigger:** Weekly (configurable, default Monday 9 AM)

**Logic:**
1. Query users with `weeklyProgress` enabled
2. Calculate week's stats (XP, sessions, achievements)
3. Generate personalized report
4. Queue notification

**Function:** `scheduleWeeklyProgress()`

---

### Scheduled: Process Notification Queue
**Trigger:** Every 5 minutes

**Logic:**
1. Query `notification_queue` where:
   - `status = 'pending'`
   - `scheduledFor <= now`
2. For each notification:
   - Check unsubscribe list
   - Send via appropriate channel (email/push)
   - Update status to 'sent' or 'failed'
   - Retry if failed (up to maxRetries)

**Function:** `processNotificationQueue()`

---

### Event: Achievement Unlocked
**Trigger:** Firestore write to `user_stats`

**Logic:**
1. Detect new achievement in `achievements.unlockedIds`
2. Check if user has achievement notifications enabled
3. Queue immediate notification

**Function:** `onAchievementUnlocked()`

## Email Templates

### Template: Daily Reminder
**ID:** `daily-reminder-v2`

**Variables:**
- `userName`: User's display name
- `streak`: Current streak days
- `dueReviews`: Number of reviews due
- `dashboardUrl`: Link to dashboard
- `unsubscribeUrl`: Unsubscribe link

**Subject:** "Time for your Japanese lesson! 🎌"

---

### Template: Weekly Progress
**ID:** `weekly-progress-v1`

**Variables:**
- `userName`: User's display name
- `weekNumber`: Week number
- `xpGained`: XP earned this week
- `sessionsCompleted`: Sessions completed
- `achievementsUnlocked`: Achievements unlocked
- `currentStreak`: Current streak
- `progressChart`: Chart image URL

**Subject:** "Your weekly Japanese progress 📊"

---

### Template: Achievement
**ID:** `achievement-unlocked-v1`

**Variables:**
- `userName`: User's display name
- `achievementName`: Achievement name
- `achievementDescription`: Achievement description
- `badgeImageUrl`: Badge image
- `nextMilestone`: Next achievement hint

**Subject:** "Achievement unlocked: {achievementName}! 🏆"

---

### Template: Streak Warning
**ID:** `streak-warning-v1`

**Variables:**
- `userName`: User's display name
- `currentStreak`: Current streak days
- `hoursLeft`: Hours until streak breaks
- `quickReviewUrl`: Quick review link

**Subject:** "Don't break your {currentStreak}-day streak! ⚡"

## Queries & Indexes

### Required Indexes
```
Collection: notification_queue
- status (asc), scheduledFor (asc)
- userId (asc), status (asc), createdAt (desc)
- type (asc), status (asc)
```

### Query Examples

**Get pending notifications:**
```javascript
const pending = await adminDb
  .collection('notification_queue')
  .where('status', '==', 'pending')
  .where('scheduledFor', '<=', Timestamp.now())
  .limit(100)
  .get()
```

**Get user's notification history:**
```javascript
const userNotifications = await adminDb
  .collection('notification_queue')
  .where('userId', '==', userId)
  .where('status', '==', 'sent')
  .orderBy('createdAt', 'desc')
  .limit(20)
  .get()
```

**Check if email unsubscribed:**
```javascript
const unsubscribeDoc = await adminDb
  .collection('notification_unsubscribes')
  .doc(email)
  .get()

const isUnsubscribed = unsubscribeDoc.exists
```

## Related Files

- API Routes: `/src/app/api/notifications/**`
- Functions: `/functions/src/notifications/`
- Email Templates: `/email-templates/`
- Hooks: `/src/hooks/useNotifications.ts`

## Analytics Use Cases

1. **Email Open Rates:** Track via unique pixels
2. **Click-Through Rates:** Track dashboard URL clicks
3. **Unsubscribe Reasons:** Improve email content
4. **Optimal Send Times:** A/B test timing
5. **Engagement:** Correlate notifications with activity

## Data Retention

- **Preferences:** Retained indefinitely
- **Queue (sent):** 90 days
- **Queue (failed):** 30 days
- **Unsubscribes:** Retained indefinitely (compliance)
- **Export:** Included in user data download

## Privacy & Compliance

- ✅ GDPR compliant (easy unsubscribe)
- ✅ CAN-SPAM compliant (unsubscribe link in all emails)
- ✅ CCPA compliant (data export/deletion)
- ✅ Double opt-in for promotional emails
- ✅ Unsubscribe list honored system-wide

## Performance Optimization

- **Batch processing:** Process queue in batches of 100
- **Rate limiting:** Max 100 emails/minute
- **Retry logic:** Exponential backoff (1min, 5min, 30min)
- **Caching:** Preference lookup cached 5 minutes
- **Lazy loading:** Template compilation on demand

## Future Enhancements

- [ ] Push notifications via FCM
- [ ] SMS notifications
- [ ] In-app notification center
- [ ] Notification scheduling UI
- [ ] A/B testing for email content
- [ ] Advanced segmentation
- [ ] Digest mode (batch daily notifications)
- [ ] Rich email templates with charts
