# Email Alerts for Firebase Functions

This guide explains how to add email notifications to Firebase Functions when errors or critical events occur.

## Overview

We use [Resend](https://resend.com) to send email alerts. The setup consists of:

1. **Alert Notifier Utility** (`functions/src/utils/alertNotifier.ts`) - Handles email sending
2. **Firebase Secret** (`RESEND_API_KEY`) - Stores the API key securely
3. **Function Integration** - Import and call the alert functions

---

## Prerequisites

- `RESEND_API_KEY` is already configured as a Firebase secret
- The `alertNotifier.ts` utility exists in `functions/src/utils/`

To verify the secret exists:
```bash
npx firebase functions:secrets:access RESEND_API_KEY
```

---

## Step-by-Step Guide

### Step 1: Import the Alert Notifier

In your function file, add the import:

```typescript
import { sendAlert } from '../utils/alertNotifier'
```

### Step 2: Define the RESEND_API_KEY Secret

At the top of your function file, with other secret definitions:

```typescript
import { defineSecret } from 'firebase-functions/params'

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
```

### Step 3: Add Secret to Function Configuration

Add `RESEND_API_KEY` to the `secrets` array in your function definition:

#### For Scheduled Functions (onSchedule)
```typescript
export const myScheduledFunction = onSchedule(
  {
    schedule: '0 * * * *', // Every hour
    timeZone: 'Asia/Tokyo',
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [RESEND_API_KEY], // Add here
  },
  async (event) => {
    // Your function code
  }
)
```

#### For Callable Functions (onCall)
```typescript
export const myCallableFunction = onCall(
  {
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [RESEND_API_KEY], // Add here
  },
  async (request) => {
    // Your function code
  }
)
```

#### For HTTP Functions (onRequest)
```typescript
export const myHttpFunction = onRequest(
  {
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [RESEND_API_KEY], // Add here
  },
  async (req, res) => {
    // Your function code
  }
)
```

#### For Firestore Triggers (onDocumentCreated, etc.)
```typescript
export const myFirestoreTrigger = onDocumentCreated(
  {
    document: 'collection/{docId}',
    secrets: [RESEND_API_KEY], // Add here
  },
  async (event) => {
    // Your function code
  }
)
```

### Step 4: Send Alerts in Your Function

Call `sendAlert()` when you want to send a notification:

```typescript
import { sendAlert } from '../utils/alertNotifier'

// Inside your function:
try {
  // Your critical operation
  await someCriticalOperation()
} catch (error) {
  // Log the error
  logger.error('Critical operation failed', { error })

  // Send email alert
  await sendAlert(RESEND_API_KEY.value(), {
    subject: 'Critical Operation Failed',
    message: `
      <strong>The operation failed!</strong><br><br>
      This is a description of what went wrong and its impact.
    `,
    details: {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      // Add any relevant context
    },
    severity: 'critical', // 'critical' | 'warning' | 'info'
  })

  throw error // Re-throw if needed
}
```

---

## Alert Severity Levels

| Severity | Emoji | Color | Use Case |
|----------|-------|-------|----------|
| `critical` | 🚨 | Red | System down, data loss, complete failures |
| `warning` | ⚠️ | Orange | Partial failures, degraded performance |
| `info` | ℹ️ | Blue | Important notifications, successful completions |

---

## Complete Example

Here's a complete example of a scheduled function with email alerts:

```typescript
import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import { sendAlert } from '../utils/alertNotifier'

const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

export const dailyDataCleanup = onSchedule(
  {
    schedule: '0 3 * * *', // 3 AM daily
    timeZone: 'Asia/Tokyo',
    memory: '1GiB',
    timeoutSeconds: 300,
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    logger.info('Starting daily data cleanup')

    const db = admin.firestore()
    let deletedCount = 0
    let errorCount = 0

    try {
      // Your cleanup logic here
      const oldDocs = await db
        .collection('temp_data')
        .where('createdAt', '<', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .limit(500)
        .get()

      for (const doc of oldDocs.docs) {
        try {
          await doc.ref.delete()
          deletedCount++
        } catch (err) {
          errorCount++
        }
      }

      logger.info('Cleanup completed', { deletedCount, errorCount })

      // Send warning if there were errors
      if (errorCount > 0) {
        await sendAlert(RESEND_API_KEY.value(), {
          subject: 'Data Cleanup Completed with Errors',
          message: `
            The daily cleanup completed but encountered some errors.<br><br>
            <strong>Deleted:</strong> ${deletedCount} documents<br>
            <strong>Errors:</strong> ${errorCount} documents failed
          `,
          details: {
            deletedCount,
            errorCount,
            timestamp: new Date().toISOString(),
          },
          severity: 'warning',
        })
      }

    } catch (error) {
      logger.error('Cleanup failed completely', { error })

      // Send critical alert for complete failure
      await sendAlert(RESEND_API_KEY.value(), {
        subject: 'Daily Data Cleanup FAILED',
        message: `
          <strong>The daily cleanup job failed completely!</strong><br><br>
          Manual intervention may be required.
        `,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          deletedBeforeFailure: deletedCount,
          timestamp: new Date().toISOString(),
        },
        severity: 'critical',
      })

      throw error
    }
  }
)
```

---

## Creating Custom Alert Functions

For specific use cases, you can create helper functions in `alertNotifier.ts`:

```typescript
// In functions/src/utils/alertNotifier.ts

/**
 * Send alert for payment processing failure
 */
export async function sendPaymentFailureAlert(
  apiKey: string | undefined,
  userId: string,
  amount: number,
  error: string
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'Payment Processing Failed',
    message: `
      <strong>A payment failed to process!</strong><br><br>
      <strong>User ID:</strong> ${userId}<br>
      <strong>Amount:</strong> ¥${amount.toLocaleString()}
    `,
    details: {
      userId,
      amount,
      error,
      timestamp: new Date().toISOString(),
    },
    severity: 'critical',
  })
}

/**
 * Send alert for API rate limit
 */
export async function sendRateLimitAlert(
  apiKey: string | undefined,
  service: string,
  currentUsage: number,
  limit: number
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: `API Rate Limit Warning: ${service}`,
    message: `
      <strong>${service} is approaching rate limits!</strong><br><br>
      <strong>Current Usage:</strong> ${currentUsage}<br>
      <strong>Limit:</strong> ${limit}<br>
      <strong>Usage:</strong> ${((currentUsage / limit) * 100).toFixed(1)}%
    `,
    details: {
      service,
      currentUsage,
      limit,
      percentUsed: ((currentUsage / limit) * 100).toFixed(1),
      timestamp: new Date().toISOString(),
    },
    severity: currentUsage > limit * 0.9 ? 'critical' : 'warning',
  })
}
```

Then use them in your functions:

```typescript
import { sendPaymentFailureAlert, sendRateLimitAlert } from '../utils/alertNotifier'

// In your payment function:
await sendPaymentFailureAlert(
  RESEND_API_KEY.value(),
  user.uid,
  1980,
  'Card declined'
)
```

---

## Adding/Changing Alert Recipients

Edit the `ALERT_EMAILS` array in `functions/src/utils/alertNotifier.ts`:

```typescript
const ALERT_EMAILS = [
  'emmanuelfabiani23@gmail.com',
  'mail.moshimoshi.app@gmail.com',
  'another-email@example.com', // Add more recipients
]
```

Then rebuild and deploy:

```bash
cd functions && npm run build
npx firebase deploy --only functions:YOUR_FUNCTION_NAME
```

---

## Deployment Checklist

After adding alerts to a function:

1. **Build the functions:**
   ```bash
   cd functions && npm run build
   ```

2. **Deploy the specific function:**
   ```bash
   npx firebase deploy --only functions:myFunctionName
   ```

3. **Verify the secret is accessible:**
   - Check the deployment logs for secret access errors
   - The deploy will automatically grant access to the secret

---

## Troubleshooting

### "RESEND_API_KEY not configured" warning in logs

The function is running but the secret isn't accessible. Check:
1. Secret exists: `npx firebase functions:secrets:access RESEND_API_KEY`
2. Secret is in the function's `secrets` array
3. Function was redeployed after adding the secret

### Emails not being received

1. Check the Resend dashboard for delivery status
2. Verify the "from" email domain is verified in Resend
3. Check spam folders
4. Look at Firebase Function logs for errors

### "Secret Payload cannot be empty" error

The secret value wasn't set properly. Re-set it:
```bash
npx firebase functions:secrets:set RESEND_API_KEY
# Then paste the API key when prompted
```

---

## Best Practices

1. **Don't over-alert** - Only send emails for truly important events
2. **Include context** - Add relevant details to help diagnose issues
3. **Use appropriate severity** - Reserve `critical` for actual emergencies
4. **Test first** - Use `severity: 'info'` during testing to avoid alarm
5. **Rate limit alerts** - Consider debouncing if an error could trigger many alerts

---

## Reference

- **Alert Notifier:** `functions/src/utils/alertNotifier.ts`
- **Example Implementation:** `functions/src/scheduled/newsScheduler.ts` (lines 271-299)
- **Resend Dashboard:** https://resend.com/emails
- **Firebase Secrets Docs:** https://firebase.google.com/docs/functions/config-env#secret-manager
