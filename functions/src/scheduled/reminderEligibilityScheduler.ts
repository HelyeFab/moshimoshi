import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'

const CRON_SECRET = defineSecret('CRON_SECRET')

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'
}

/**
 * Daily reminder eligibility scheduler.
 *
 * Runs at 18:00 UTC and triggers the server-side eligibility job that:
 * - computes "used yesterday, not today" in user timezone
 * - builds top 5 eligible features per user
 * - creates + sends custom email campaigns
 */
export const dailyReminderEligibilityJob = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540,
    retryCount: 1,
    secrets: [CRON_SECRET],
  },
  async event => {
    const appUrl = getAppUrl()
    const endpoint = `${appUrl}/api/notifications/reminder-summary`

    logger.info('[ReminderEligibilityScheduler] Triggered', {
      scheduleTime: event.scheduleTime,
      jobName: event.jobName,
      endpoint,
    })

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CRON_SECRET.value()}`,
        'Content-Type': 'application/json',
      },
    })

    const bodyText = await response.text()

    if (!response.ok) {
      logger.error('[ReminderEligibilityScheduler] Job request failed', {
        status: response.status,
        body: bodyText,
      })
      throw new Error(`Reminder summary job failed: ${response.status}`)
    }

    logger.info('[ReminderEligibilityScheduler] Job request succeeded', {
      status: response.status,
      body: bodyText.slice(0, 1000),
    })
  }
)
