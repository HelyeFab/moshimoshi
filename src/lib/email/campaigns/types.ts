/**
 * Email Campaign Types
 *
 * Defines TypeScript interfaces for the email campaign system.
 * Campaigns are stored in Firestore collection: `email_campaigns`
 */

import { Timestamp } from 'firebase-admin/firestore'

export type CampaignTemplate = 'waitlist' | 'welcome' | 'password_reset' | 'custom'
export type CampaignSegment = 'all' | 'free' | 'premium_monthly' | 'premium_yearly' | 'custom_emails'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed'

/**
 * Email Campaign Document (Firestore)
 */
export interface EmailCampaign {
  id: string
  name: string
  template: CampaignTemplate
  subject: string

  // Custom template support (when template === 'custom')
  templateId?: string                           // Reference to email_templates collection
  templateVariables?: Record<string, string>    // Variable value overrides

  // Test email for sending preview to yourself
  testEmail?: string

  // Segmentation
  segment: {
    type: CampaignSegment
    respectMarketingPrefs: boolean // Check preferences.notifications.marketingEmails
    emailVerifiedOnly: boolean
    customEmails?: string[] // For 'custom_emails' segment type
  }

  // Status tracking
  status: CampaignStatus

  // Statistics
  stats: {
    totalRecipients: number
    sentCount: number
    failedCount: number
    skippedCount: number // Users who opted out
  }

  // Audit
  createdBy: string // Admin UID
  createdAt: Timestamp
  sentAt?: Timestamp

  // Error tracking
  errors?: Array<{
    email: string
    error: string
    timestamp: Timestamp
  }>
}

/**
 * Request body for creating a new campaign
 */
export interface SendCampaignRequest {
  name: string
  template: CampaignTemplate
  subject: string
  templateId?: string                         // When template === 'custom'
  templateVariables?: Record<string, string>  // Variable overrides
  testEmail?: string                          // Email for sending test
  segment: {
    type: CampaignSegment
    respectMarketingPrefs: boolean
    emailVerifiedOnly: boolean
    customEmails?: string[] // For 'custom_emails' segment type
  }
}

/**
 * Campaign progress tracking (for real-time updates)
 */
export interface CampaignProgress {
  campaignId: string
  status: CampaignStatus
  progress: {
    total: number
    sent: number
    failed: number
    skipped: number
  }
}

/**
 * User record for batch sending
 */
export interface CampaignRecipient {
  uid: string
  email: string
}
