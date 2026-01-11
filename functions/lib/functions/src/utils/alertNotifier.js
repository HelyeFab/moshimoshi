"use strict";
/**
 * Alert Notifier - Sends email alerts when critical failures occur
 * Uses Resend API (https://resend.com)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlert = sendAlert;
exports.sendScraperFailureAlert = sendScraperFailureAlert;
exports.sendStoryGenerationFailureAlert = sendStoryGenerationFailureAlert;
exports.sendStoryGenerationWarningAlert = sendStoryGenerationWarningAlert;
const logger = __importStar(require("firebase-functions/logger"));
// Configuration - alert recipients
const ALERT_EMAILS = [
    'emmanuelfabiani23@gmail.com',
    'mail.moshimoshi.app@gmail.com',
];
/**
 * Send an email alert via Resend API
 * Requires RESEND_API_KEY to be passed (from Firebase secret)
 */
async function sendAlert(apiKey, payload) {
    const { subject, message, details, severity = 'critical' } = payload;
    if (!apiKey) {
        logger.warn('[AlertNotifier] RESEND_API_KEY not configured, skipping email alert', {
            subject,
            severity,
        });
        return false;
    }
    try {
        const severityEmoji = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️',
        };
        const severityColor = {
            critical: '#dc2626',
            warning: '#f59e0b',
            info: '#3b82f6',
        };
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
      ${details
            ? `
      <div class="details">
        <pre>${JSON.stringify(details, null, 2)}</pre>
      </div>
      `
            : ''}
    </div>
    <div class="footer">
      Moshimoshi Alert System &bull; ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
`;
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
        });
        if (!response.ok) {
            const errorText = await response.text();
            logger.error('[AlertNotifier] Failed to send email', {
                status: response.status,
                error: errorText,
            });
            return false;
        }
        const result = await response.json();
        logger.info('[AlertNotifier] Email alert sent successfully', {
            emailId: result.id,
            subject,
            severity,
        });
        return true;
    }
    catch (error) {
        logger.error('[AlertNotifier] Error sending email alert', {
            error: error instanceof Error ? error.message : 'Unknown error',
            subject,
        });
        return false;
    }
}
/**
 * Send alert for news scraper failure
 */
async function sendScraperFailureAlert(apiKey, failedSources, errors, totalSources) {
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
    });
}
/**
 * Send alert for story generation failure
 */
async function sendStoryGenerationFailureAlert(apiKey, draftId, step, error, additionalDetails) {
    return sendAlert(apiKey, {
        subject: 'Daily Story Generation Failed',
        message: `
      <strong>The daily story generation failed!</strong><br><br>
      This means no new story was published today. Users will see yesterday's content until this is fixed.<br><br>
      <strong>Failed at step:</strong> ${step}<br>
      <strong>Draft ID:</strong> ${draftId}
    `,
        details: Object.assign(Object.assign({ draftId,
            step,
            error }, additionalDetails), { timestamp: new Date().toISOString(), action: 'Check Firebase Function logs and Vercel API logs for the generate-story route' }),
        severity: 'critical',
    });
}
/**
 * Send alert for story generation with partial failures (e.g., images failed)
 */
async function sendStoryGenerationWarningAlert(apiKey, storyId, warnings, details) {
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
        details: Object.assign(Object.assign({ storyId,
            warnings }, details), { timestamp: new Date().toISOString(), action: 'Check the story in the admin panel and repair if needed' }),
        severity: 'warning',
    });
}
//# sourceMappingURL=alertNotifier.js.map