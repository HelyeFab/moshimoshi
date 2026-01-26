# Email Notification System

This document describes the email notification system used for alerting administrators about important events in the Moshimoshi platform.

## Overview

The notification system uses **Resend API** to send HTML-formatted emails to administrators when specific events occur. Notifications are categorized by severity:

- **Critical** (🚨 red) - System failures requiring immediate attention
- **Warning** (⚠️ orange) - Issues that need review but aren't blocking
- **Info** (ℹ️ blue) - Informational alerts about user activity

## Recipients

All notifications are sent to:
- `emmanuelfabiani23@gmail.com`
- `mail.moshimoshi.app@gmail.com`

To modify recipients, edit `functions/src/utils/alertNotifier.ts`:

```typescript
const ALERT_EMAILS = [
  'emmanuelfabiani23@gmail.com',
  'mail.moshimoshi.app@gmail.com',
]
```

## Current Notifications

### 1. Story Generation Alerts

| Alert | Trigger | Severity | File |
|-------|---------|----------|------|
| Generation Failed | Story generation fails at any critical step | Critical | `storyScheduler.ts` |
| Generated with Issues | Story published but with partial failures (e.g., some images failed) | Warning | `storyScheduler.ts` |

### 2. Comic Generation Alerts

| Alert | Trigger | Severity | File |
|-------|---------|----------|------|
| Generation Failed | Comic episode generation fails | Critical | `comicScheduler.ts` |

### 3. News Scraper Alerts

| Alert | Trigger | Severity | File |
|-------|---------|----------|------|
| Scraper Failed | All news scrapers fail | Critical | `storyScheduler.ts` |

### 4. Tea House (Q&A) Alerts

| Alert | Trigger | Severity | File |
|-------|---------|----------|------|
| New Question | User posts a question that passes moderation | Info | `qa-moderation.ts` |
| New Answer | User posts an answer that passes moderation | Info | `qa-moderation.ts` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloud Functions                          │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ Feature Function │───▶│ alertNotifier.ts             │   │
│  │ (e.g., qa-mod)   │    │                              │   │
│  └──────────────────┘    │  sendAlert()                 │   │
│                          │  sendTeaHouseQuestionAlert() │   │
│                          │  sendTeaHouseAnswerAlert()   │   │
│                          │  sendStoryGenerationAlert()  │   │
│                          │  etc.                        │   │
│                          └──────────────┬───────────────┘   │
└─────────────────────────────────────────┼───────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │     Resend API        │
                              │  (RESEND_API_KEY)     │
                              └───────────┬───────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │   Admin Inboxes       │
                              └───────────────────────┘
```

## How to Add New Notifications

### Step 1: Add Alert Function to `alertNotifier.ts`

Edit `functions/src/utils/alertNotifier.ts` and add a new function:

```typescript
/**
 * Send alert for [Your Feature] event
 */
export async function sendYourFeatureAlert(
  apiKey: string | undefined,
  // Add parameters specific to your notification
  itemId: string,
  details: { name: string; email: string }
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'Your Alert Subject',
    message: `
      <strong>Description of what happened</strong><br><br>
      <strong>Item ID:</strong> ${itemId}<br>
      <strong>User:</strong> ${details.name} (${details.email})<br><br>
      <a href="https://moshimoshi.app/path/to/${itemId}" style="color: #6366f1;">View Item</a>
    `,
    details: {
      itemId,
      userName: details.name,
      userEmail: details.email,
      timestamp: new Date().toISOString(),
    },
    severity: 'info', // or 'warning' or 'critical'
  })
}
```

### Step 2: Import and Use in Your Cloud Function

In your Cloud Function file (e.g., `functions/src/your-feature.ts`):

```typescript
import { defineSecret } from 'firebase-functions/params';
import { sendYourFeatureAlert } from './utils/alertNotifier';

// Define the secret (if not already defined)
const resendApiKey = defineSecret('RESEND_API_KEY');

export const yourFunction = onDocumentCreated(
  {
    document: 'your_collection/{docId}',
    secrets: [resendApiKey], // Include the secret
    // ... other options
  },
  async (event) => {
    // Your function logic...

    // Send notification
    try {
      await sendYourFeatureAlert(
        resendApiKey.value(),
        docId,
        { name: data.author.name, email: data.author.email }
      );
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Don't fail the main operation if notification fails
    }
  }
);
```

### Step 3: Deploy

```bash
cd functions
npm run build
firebase deploy --only functions:yourFunction
```

## Alert Function Reference

### `sendAlert(apiKey, payload)`

The base function for sending alerts.

**Parameters:**
- `apiKey: string | undefined` - Resend API key
- `payload: AlertPayload` - Alert configuration

**AlertPayload:**
```typescript
interface AlertPayload {
  subject: string           // Email subject (without emoji prefix)
  message: string           // HTML message body
  details?: Record<string, any>  // JSON details shown in monospace block
  severity?: 'critical' | 'warning' | 'info'  // Default: 'critical'
}
```

### Pre-built Alert Functions

| Function | Purpose | Parameters |
|----------|---------|------------|
| `sendScraperFailureAlert` | News scraper failures | `apiKey, failedSources[], errors, totalSources` |
| `sendStoryGenerationFailureAlert` | Story generation failures | `apiKey, draftId, step, error, additionalDetails?` |
| `sendStoryGenerationWarningAlert` | Story generation warnings | `apiKey, storyId, warnings[], details` |
| `sendTeaHouseQuestionAlert` | New Q&A question | `apiKey, questionId, title, author{name, email}` |
| `sendTeaHouseAnswerAlert` | New Q&A answer | `apiKey, answerId, questionId, questionTitle, author{name, email}` |

## Email Format

All emails follow this HTML structure:

```
┌─────────────────────────────────────┐
│ [Color Header based on severity]    │
│ 🚨/⚠️/ℹ️ Subject                    │
├─────────────────────────────────────┤
│                                     │
│ Message content (HTML)              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ {                               │ │
│ │   "details": "as JSON"          │ │
│ │ }                               │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ Moshimoshi Alert System • timestamp │
└─────────────────────────────────────┘
```

## Configuration

### Firebase Secrets

The `RESEND_API_KEY` must be configured as a Firebase secret:

```bash
firebase functions:secrets:set RESEND_API_KEY
```

### Environment

- **From Address:** `Moshimoshi Alerts <alerts@moshimoshi.app>`
- **API Endpoint:** `https://api.resend.com/emails`

## Troubleshooting

### Emails not sending

1. Check if `RESEND_API_KEY` is configured:
   ```bash
   firebase functions:secrets:access RESEND_API_KEY
   ```

2. Check function logs:
   ```bash
   gcloud functions logs read <functionName> --project moshimoshi-de237 --gen2 --limit 20
   ```

3. Look for `[AlertNotifier]` log entries

### Testing notifications

Create a test document in Firestore that triggers your Cloud Function. For Tea House:

```typescript
// Create a question with moderationStatus: 'pending'
// The moderateQuestion function will process it and send notification if approved
```

## Files Reference

| File | Purpose |
|------|---------|
| `functions/src/utils/alertNotifier.ts` | Core alert functions and email template |
| `functions/src/qa-moderation.ts` | Tea House Q&A notifications |
| `functions/src/scheduled/storyScheduler.ts` | Story generation notifications |
| `functions/src/scheduled/comicScheduler.ts` | Comic generation notifications |

---

*Last Updated: 2026-01-25*
