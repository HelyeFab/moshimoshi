# Notification System Documentation

## Overview

The Moshimoshi notification system provides multi-channel notifications to keep users engaged with their Japanese learning journey. The system supports email notifications (implemented), with infrastructure ready for push notifications and in-app notifications.

## Architecture

### Components

1. **Email Templates** (`/src/lib/notifications/email-templates/`)
   - Base template with consistent branding
   - Daily reminder emails
   - Achievement alert emails
   - Weekly progress report emails

2. **Notification Service** (`/src/lib/notifications/notification-service.ts`)
   - Central service for sending all notifications
   - Handles user preference checking
   - Manages notification logging
   - Provides unsubscribe token generation

3. **API Endpoints** (`/src/app/api/notifications/`)
   - `/daily-reminder` - Triggered hourly by cron
   - `/weekly-progress` - Triggered weekly on Sundays
   - `/unsubscribe` - Handles email unsubscribe links

4. **Cron Jobs** (configured in `vercel.json`)
   - Daily reminders: Every hour (checks user timezones)
   - Weekly reports: Sundays at 6 PM UTC

## Features

### Email Notifications

#### Daily Study Reminders
- **Trigger**: Hourly cron job
- **Recipients**: Users with `dailyReminder` enabled
- **Content**:
  - Current streak
  - Reviews due
  - Last study date
  - Motivational quotes
  - Study tips
- **Personalization**: Based on user's timezone and preferred reminder time

#### Achievement Alerts
- **Trigger**: Real-time when achievement unlocked
- **Recipients**: Users with `achievementAlerts` enabled
- **Content**:
  - Achievement name and description
  - Points earned
  - Overall progress
  - Next achievements to unlock
- **Integration**: Hooks into the achievement system

#### Weekly Progress Reports
- **Trigger**: Sunday evenings
- **Recipients**: Users with `weeklyProgress` enabled
- **Content**:
  - Week's statistics (reviews, accuracy, study time)
  - Items learned (kanji, vocabulary, sentences)
  - Achievements unlocked
  - Daily activity chart
  - Suggested goals for next week
- **Smart Filtering**: Skips inactive users (30+ days)

### User Preferences

Stored in Firestore at `users/{userId}/preferences/settings`:

```javascript
{
  notifications: {
    dailyReminder: boolean,
    achievementAlerts: boolean,
    weeklyProgress: boolean,
    marketingEmails: boolean,
    reminderTime: "09:00", // 24-hour format
    timezone: "America/New_York"
  }
}
```

### Notification Logging

All sent notifications are logged in Firestore at `users/{userId}/notificationLogs`:

```javascript
{
  userId: string,
  type: 'daily_reminder' | 'achievement_alert' | 'weekly_progress',
  channel: 'email' | 'push' | 'in_app',
  sentAt: Timestamp,
  status: 'sent' | 'failed' | 'bounced' | 'opened' | 'clicked',
  metadata: object,
  error?: string
}
```

## Setup Instructions

### 1. Environment Variables

Add to your `.env.local`:

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
CRON_SECRET=your_secure_random_string_here
NEXT_PUBLIC_APP_URL=https://your-app-url.com

# Optional
NOTIFICATION_EMAIL_FROM=noreply@your-domain.com
NOTIFICATION_EMAIL_SUPPORT=support@your-domain.com
```

### 2. Resend Configuration

1. Sign up at [Resend](https://resend.com)
2. Verify your domain
3. Create an API key
4. Add the API key to your environment variables

### 3. Vercel Cron Jobs

The cron jobs are already configured in `vercel.json`. They will automatically start running when deployed to Vercel.

For local testing, you can manually trigger the endpoints:

```bash
# Test daily reminder for a specific user
curl -X POST http://localhost:3000/api/notifications/daily-reminder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"userId": "USER_ID"}'

# Test weekly progress for a specific user
curl -X POST http://localhost:3000/api/notifications/weekly-progress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"userId": "USER_ID"}'
```

### 4. Achievement Integration

To enable achievement notifications, integrate with your achievement system:

```typescript
import { attachAchievementNotifications } from '@/lib/notifications/achievement-notification-hook'
import { AchievementSystem } from '@/lib/review-engine/progress/achievement-system'

// In your component or hook
const achievementSystem = new AchievementSystem(userId, progressTracker)
const notificationHook = attachAchievementNotifications(achievementSystem, userId)

// Clean up when done
notificationHook.destroy()
```

## Testing

### Email Template Preview

Create a test script to preview email templates:

```typescript
import { dailyReminderHtml } from '@/lib/notifications/email-templates'

const previewData = {
  userName: 'Test User',
  currentStreak: 7,
  totalReviews: 150,
  dueReviews: 25,
  lastStudyDate: new Date(),
  studyUrl: 'http://localhost:3000/review',
  unsubscribeUrl: '#',
  preferencesUrl: '#'
}

console.log(dailyReminderHtml(previewData))
```

### Manual Testing Checklist

- [ ] Daily reminder sends at correct time for user timezone
- [ ] Achievement alerts trigger immediately on unlock
- [ ] Weekly reports send on Sunday evenings
- [ ] Unsubscribe links work correctly
- [ ] Notification preferences are respected
- [ ] Logs are created in Firestore
- [ ] Email formatting looks good in major clients

## Future Enhancements

### Phase 2: Push Notifications
- Install Firebase Cloud Messaging
- Implement service worker
- Add permission request flow
- Store FCM tokens

### Phase 3: In-App Notifications
- Create notification center UI
- Real-time updates with Firestore
- Mark as read functionality
- Notification badges

### Phase 4: Advanced Features
- A/B testing for email content
- Optimal send time detection
- Engagement tracking
- Custom notification schedules
- SMS notifications (Twilio integration)

## Troubleshooting

### Common Issues

**Emails not sending:**
- Check Resend API key is valid
- Verify domain is configured in Resend
- Check user has valid email address
- Review notification logs for errors

**Cron jobs not running:**
- Verify CRON_SECRET is set in Vercel environment
- Check Vercel dashboard for cron job status
- Review function logs in Vercel

**Users not receiving notifications:**
- Check user preferences in Firestore
- Verify notification logs show "sent" status
- Check spam folders
- Test with different email providers

**Timezone issues:**
- Currently using simplified timezone offset map
- Consider implementing proper timezone library (moment-timezone)
- Ensure user timezone is set in preferences

## API Reference

### POST /api/notifications/daily-reminder
Send daily reminder to specific user (manual trigger)

**Request:**
```json
{
  "userId": "string"
}
```

### POST /api/notifications/weekly-progress
Send weekly report to specific user (manual trigger)

**Request:**
```json
{
  "userId": "string"
}
```

### GET /api/notifications/unsubscribe
Unsubscribe via email link

**Query Parameters:**
- `token`: Base64 encoded unsubscribe token

### POST /api/notifications/unsubscribe
Programmatic unsubscribe

**Request:**
```json
{
  "userId": "string",
  "notificationType": "daily_reminder" | "achievement_alerts" | "weekly_progress" | "marketing" | "all"
}
```

## Performance Considerations

- Batch processing: Notifications are sent in batches of 5-10 to avoid rate limiting
- Debouncing: Achievement notifications are debounced to avoid spam
- Caching: User preferences are cached to reduce database reads
- Async processing: All notifications sent asynchronously
- Error resilience: Individual failures don't block other notifications

## Security

- Unsubscribe tokens expire after 24 hours
- Cron endpoints protected by CRON_SECRET
- User data never exposed in email links
- All API endpoints require authentication
- Email addresses validated before sending

## Monitoring

Monitor the following metrics:
- Email delivery rate (Resend dashboard)
- Cron job success rate (Vercel dashboard)
- Notification opt-out rate
- Email open/click rates
- User engagement after notifications

## Support

For issues or questions:
1. Check notification logs in Firestore
2. Review Vercel function logs
3. Check Resend dashboard for delivery status
4. Contact support@moshimoshi.app