/**
 * Alert Notifier - Sends email alerts when critical failures occur
 * Uses Resend API (https://resend.com)
 */

import * as logger from 'firebase-functions/logger'

// Configuration - alert recipients
const ALERT_EMAILS = [
  'emmanuelfabiani23@gmail.com',
  'mail.moshimoshi.app@gmail.com',
]

interface AlertPayload {
  subject: string
  message: string
  details?: Record<string, any>
  severity?: 'critical' | 'warning' | 'info'
}

/**
 * Send an email alert via Resend API
 * Requires RESEND_API_KEY to be passed (from Firebase secret)
 */
export async function sendAlert(
  apiKey: string | undefined,
  payload: AlertPayload
): Promise<boolean> {
  const { subject, message, details, severity = 'critical' } = payload

  if (!apiKey) {
    logger.warn('[AlertNotifier] RESEND_API_KEY not configured, skipping email alert', {
      subject,
      severity,
    })
    return false
  }

  try {
    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    }

    const severityColor = {
      critical: '#dc2626',
      warning: '#f59e0b',
      info: '#3b82f6',
    }

    // Build HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: ${severityColor[severity]}; color: white; padding: 20px; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { padding: 20px; }
    .message { font-size: 16px; color: #333; line-height: 1.5; margin-bottom: 20px; }
    .details { background: #f8f9fa; border-radius: 4px; padding: 15px; font-family: monospace; font-size: 13px; }
    .details pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .footer { padding: 15px 20px; background: #f8f9fa; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severityEmoji[severity]} ${subject}</h1>
    </div>
    <div class="content">
      <div class="message">${message}</div>
      ${
        details
          ? `
      <div class="details">
        <pre>${JSON.stringify(details, null, 2)}</pre>
      </div>
      `
          : ''
      }
    </div>
    <div class="footer">
      Moshimoshi Alert System &bull; ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
`

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Moshimoshi Alerts <alerts@moshimoshi.app>',
        to: ALERT_EMAILS,
        subject: `${severityEmoji[severity]} [Moshimoshi] ${subject}`,
        html: htmlContent,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('[AlertNotifier] Failed to send email', {
        status: response.status,
        error: errorText,
      })
      return false
    }

    const result = await response.json()
    logger.info('[AlertNotifier] Email alert sent successfully', {
      emailId: result.id,
      subject,
      severity,
    })

    return true
  } catch (error) {
    logger.error('[AlertNotifier] Error sending email alert', {
      error: error instanceof Error ? error.message : 'Unknown error',
      subject,
    })
    return false
  }
}

/**
 * Send alert for news scraper failure
 */
export async function sendScraperFailureAlert(
  apiKey: string | undefined,
  failedSources: string[],
  errors: Record<string, string>,
  totalSources: number
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'News Scraper Failed',
    message: `
      <strong>All news scrapers failed!</strong><br><br>
      This means no new articles are being fetched from NHK Easy News.
      The app will continue to show existing articles, but no new content will appear until this is fixed.<br><br>
      <strong>Failed sources:</strong> ${failedSources.join(', ')}<br>
      <strong>Total sources:</strong> ${totalSources}
    `,
    details: {
      failedSources,
      errors,
      timestamp: new Date().toISOString(),
      action: 'Check Firebase Function logs and Railway API connectivity',
    },
    severity: 'critical',
  })
}

/**
 * Send alert for story generation failure
 */
export async function sendStoryGenerationFailureAlert(
  apiKey: string | undefined,
  draftId: string,
  step: string,
  error: string,
  additionalDetails?: Record<string, any>
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'Daily Story Generation Failed',
    message: `
      <strong>The daily story generation failed!</strong><br><br>
      This means no new story was published today. Users will see yesterday's content until this is fixed.<br><br>
      <strong>Failed at step:</strong> ${step}<br>
      <strong>Draft ID:</strong> ${draftId}
    `,
    details: {
      draftId,
      step,
      error,
      ...additionalDetails,
      timestamp: new Date().toISOString(),
      action: 'Check Firebase Function logs and Vercel API logs for the generate-story route',
    },
    severity: 'critical',
  })
}

/**
 * Send alert for story generation with partial failures (e.g., images failed)
 */
export async function sendStoryGenerationWarningAlert(
  apiKey: string | undefined,
  storyId: string,
  warnings: string[],
  details: Record<string, any>
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'Story Generated with Issues',
    message: `
      <strong>A story was generated but had some issues:</strong><br><br>
      <ul>
        ${warnings.map(w => `<li>${w}</li>`).join('')}
      </ul>
      <br>
      <strong>Story ID:</strong> ${storyId}<br>
      The story was still published but may need manual review.
    `,
    details: {
      storyId,
      warnings,
      ...details,
      timestamp: new Date().toISOString(),
      action: 'Check the story in the admin panel and repair if needed',
    },
    severity: 'warning',
  })
}

/**
 * Send alert for new Tea House question
 */
export async function sendTeaHouseQuestionAlert(
  apiKey: string | undefined,
  questionId: string,
  title: string,
  author: { name: string; email: string }
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'New Tea House Question',
    message: `
      <strong>A new question was posted in the Tea House!</strong><br><br>
      <strong>Title:</strong> ${title}<br>
      <strong>Author:</strong> ${author.name} (${author.email})<br><br>
      <a href="https://moshimoshi.app/en/village/tea-house/${questionId}" style="color: #6366f1;">View Question</a>
    `,
    details: {
      questionId,
      title,
      authorName: author.name,
      authorEmail: author.email,
      timestamp: new Date().toISOString(),
    },
    severity: 'info',
  })
}

/**
 * Send alert for new Tea House answer
 */
export async function sendTeaHouseAnswerAlert(
  apiKey: string | undefined,
  answerId: string,
  questionId: string,
  questionTitle: string,
  author: { name: string; email: string }
): Promise<boolean> {
  return sendAlert(apiKey, {
    subject: 'New Tea House Answer',
    message: `
      <strong>A new answer was posted in the Tea House!</strong><br><br>
      <strong>Question:</strong> ${questionTitle}<br>
      <strong>Answered by:</strong> ${author.name} (${author.email})<br><br>
      <a href="https://moshimoshi.app/en/village/tea-house/${questionId}" style="color: #6366f1;">View Answer</a>
    `,
    details: {
      answerId,
      questionId,
      questionTitle,
      authorName: author.name,
      authorEmail: author.email,
      timestamp: new Date().toISOString(),
    },
    severity: 'info',
  })
}
