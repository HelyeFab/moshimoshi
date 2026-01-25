/**
 * Email Suppression System Types
 *
 * Industry-standard email suppression for CAN-SPAM/GDPR compliance.
 * Tracks unsubscribes, bounces, and complaints at the email level.
 */

import { Timestamp } from 'firebase-admin/firestore'

/**
 * Reason why an email was suppressed
 */
export type SuppressionReason =
  | 'unsubscribe'    // User clicked unsubscribe link
  | 'bounce'         // Email bounced (hard bounce)
  | 'complaint'      // User marked as spam
  | 'manual'         // Admin manually suppressed
  | 'invalid'        // Invalid email format detected

/**
 * Source of the suppression action
 */
export type SuppressionSource =
  | 'one-click'      // List-Unsubscribe header (email client)
  | 'link'           // Clicked unsubscribe link in email
  | 'settings'       // User disabled in account settings
  | 'webhook'        // Resend/SendGrid webhook (bounce/complaint)
  | 'admin'          // Admin action

/**
 * Email suppression record stored in Firestore
 * Collection: email_suppressions
 * Document ID: SHA256 hash of lowercase email
 */
export interface EmailSuppression {
  /** Original email address */
  email: string

  /** SHA256 hash for verification */
  emailHash: string

  /** Why the email was suppressed */
  reason: SuppressionReason

  /** How the suppression was triggered */
  source: SuppressionSource

  /** When the suppression was created */
  suppressedAt: Timestamp

  /** Optional metadata for audit trail */
  metadata?: {
    /** Campaign that triggered the unsubscribe */
    campaignId?: string

    /** User agent from the request */
    userAgent?: string

    /** IP address (for fraud prevention) */
    ipAddress?: string

    /** Associated user ID if known */
    userId?: string

    /** Bounce type from email provider */
    bounceType?: 'hard' | 'soft'

    /** Original webhook payload for debugging */
    webhookPayload?: Record<string, unknown>
  }
}

/**
 * Payload for unsubscribe token (HMAC-signed)
 */
export interface UnsubscribeTokenPayload {
  /** Email address to unsubscribe */
  email: string

  /** Expiration timestamp (Unix seconds) */
  exp: number

  /** Issued at timestamp (Unix seconds) */
  iat: number
}

/**
 * Result of token verification
 */
export interface TokenVerificationResult {
  valid: boolean
  payload?: UnsubscribeTokenPayload
  error?: 'invalid_signature' | 'expired' | 'malformed'
}

/**
 * Options for creating an unsubscribe token
 */
export interface CreateTokenOptions {
  /** Token expiration in days (default: 7) */
  expiresInDays?: number
}

/**
 * Options for checking suppression
 */
export interface SuppressionCheckOptions {
  /** Include soft bounces in suppression check */
  includeSoftBounces?: boolean
}

/**
 * Result of a suppression check
 */
export interface SuppressionCheckResult {
  suppressed: boolean
  reason?: SuppressionReason
  suppressedAt?: Date
}

/**
 * Batch suppression check result
 */
export interface BatchSuppressionResult {
  /** Emails that are suppressed */
  suppressed: string[]

  /** Emails that are not suppressed */
  allowed: string[]

  /** Map of email -> suppression details */
  details: Map<string, SuppressionCheckResult>
}

/**
 * Resend webhook event types we handle
 */
export type ResendWebhookType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'

/**
 * Resend webhook payload structure
 */
export interface ResendWebhookPayload {
  type: ResendWebhookType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Bounce-specific fields
    bounce?: {
      type: 'hard' | 'soft'
      message: string
    }
  }
}
