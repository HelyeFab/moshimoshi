/**
 * Email Suppression System
 *
 * Production-ready email suppression for CAN-SPAM/GDPR compliance.
 *
 * Usage:
 *
 * // Check if email is suppressed before sending
 * const { suppressed } = await suppressionService.isEmailSuppressed('user@example.com')
 * if (suppressed) return // Don't send
 *
 * // Generate unsubscribe URL for email footer
 * const unsubscribeUrl = generateUnsubscribeUrl('user@example.com')
 *
 * // Add suppression (from unsubscribe endpoint or webhook)
 * await suppressionService.addSuppression('user@example.com', 'unsubscribe', 'link')
 */

export { suppressionService, SuppressionService } from './service'

export {
  hashEmail,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  generateUnsubscribeUrl,
  generateOneClickUnsubscribeUrl,
} from './tokens'

export type {
  EmailSuppression,
  SuppressionReason,
  SuppressionSource,
  SuppressionCheckResult,
  BatchSuppressionResult,
  UnsubscribeTokenPayload,
  TokenVerificationResult,
  CreateTokenOptions,
  ResendWebhookType,
  ResendWebhookPayload,
} from './types'
