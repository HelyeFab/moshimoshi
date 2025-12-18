/**
 * Email Campaign Service
 *
 * Handles batch sending of email campaigns to segmented users.
 * Core responsibilities:
 * - Query users based on segment criteria
 * - Filter users by email preferences
 * - Send emails in batches with rate limiting
 * - Update campaign status in real-time
 * - Track errors and failures
 */

import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { sendEmail } from '@/lib/email/resend'
import { buildWaitlistThankYouContent } from '@/lib/email/waitlistThankYou'
import type {
  EmailCampaign,
  CampaignRecipient,
  CampaignSegment,
} from './types'

export class CampaignService {
  // Batch configuration for rate limiting
  private readonly BATCH_SIZE = 50
  private readonly BATCH_DELAY_MS = 1000

  constructor() {
    ensureAdminInitialized()
  }

  /**
   * Query users based on segment criteria
   * Filters by subscription type, email verification, and marketing preferences
   */
  async getUsersForSegment(
    segment: EmailCampaign['segment']
  ): Promise<CampaignRecipient[]> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const users: CampaignRecipient[] = []

    // Base query on users collection
    let query: FirebaseFirestore.Query = adminFirestore.collection('users')

    // Filter by subscription type
    if (segment.type === 'free') {
      // Free users have no subscription object OR subscription.plan === 'free'
      // For simplicity, we'll query all and filter in-memory
      // Firestore doesn't support OR queries easily
    } else if (segment.type === 'premium_monthly') {
      query = query
        .where('subscription.plan', '==', 'premium_monthly')
        .where('subscription.status', 'in', ['active', 'trialing'])
    } else if (segment.type === 'premium_yearly') {
      query = query
        .where('subscription.plan', '==', 'premium_yearly')
        .where('subscription.status', 'in', ['active', 'trialing'])
    }

    const snapshot = await query.get()
    console.log(`[CampaignService] Found ${snapshot.size} potential users for segment: ${segment.type}`)

    for (const doc of snapshot.docs) {
      const data = doc.data()
      const uid = doc.id

      // Additional filtering for 'all' and 'free' segments
      if (segment.type === 'free') {
        // Check if user has an active premium subscription
        const isPremium =
          data.subscription &&
          (data.subscription.plan === 'premium_monthly' ||
            data.subscription.plan === 'premium_yearly') &&
          (data.subscription.status === 'active' || data.subscription.status === 'trialing')

        if (isPremium) {
          continue // Skip premium users
        }
      }

      // Get user email from Firebase Auth
      const email = await this.getUserEmail(uid)
      if (!email) {
        console.warn(`[CampaignService] No email found for user: ${uid}`)
        continue
      }

      // Check email verified
      if (segment.emailVerifiedOnly) {
        const emailVerified = await this.isEmailVerified(uid)
        if (!emailVerified) {
          continue
        }
      }

      // Check marketing preferences
      if (segment.respectMarketingPrefs) {
        const prefs = await this.getUserPreferences(uid)
        // Only skip if user explicitly opted OUT (set to false)
        // If preference doesn't exist, assume opt-in (default)
        if (prefs?.notifications?.marketingEmails === false) {
          continue // User explicitly opted out
        }
      }

      users.push({ uid, email })
    }

    console.log(`[CampaignService] Filtered to ${users.length} eligible recipients`)
    return users
  }

  /**
   * Send campaign to all users in segment
   * Uses batching and rate limiting to avoid Resend API limits
   */
  async sendCampaign(campaignId: string): Promise<void> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const campaignRef = adminFirestore.collection('email_campaigns').doc(campaignId)
    const campaignSnap = await campaignRef.get()

    if (!campaignSnap.exists) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }

    const campaign = { id: campaignId, ...campaignSnap.data() } as EmailCampaign

    console.log(`[CampaignService] Starting campaign: ${campaign.name}`)

    // Update status to 'sending'
    await campaignRef.update({
      status: 'sending',
    })

    // Get eligible recipients
    const users = await this.getUsersForSegment(campaign.segment)

    // Update total recipients
    await campaignRef.update({
      'stats.totalRecipients': users.length,
    })

    if (users.length === 0) {
      console.warn(`[CampaignService] No eligible recipients for campaign: ${campaignId}`)
      await campaignRef.update({
        status: 'sent',
        sentAt: Timestamp.now(),
      })
      return
    }

    // Send in batches
    let sent = 0
    let failed = 0
    const errors: EmailCampaign['errors'] = []

    for (let i = 0; i < users.length; i += this.BATCH_SIZE) {
      const batch = users.slice(i, i + this.BATCH_SIZE)
      console.log(
        `[CampaignService] Sending batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(users.length / this.BATCH_SIZE)} (${batch.length} emails)`
      )

      // Send emails in parallel within batch
      const results = await Promise.allSettled(
        batch.map((user) => this.sendEmailToUser(user, campaign))
      )

      // Update counters
      for (let j = 0; j < results.length; j++) {
        const result = results[j]
        if (result.status === 'fulfilled') {
          sent++
        } else {
          failed++
          const user = batch[j]
          errors.push({
            email: user.email,
            error: result.reason?.message || 'Unknown error',
            timestamp: Timestamp.now(),
          })
          console.error(
            `[CampaignService] Failed to send to ${user.email}:`,
            result.reason
          )
        }
      }

      // Update progress in Firestore
      await campaignRef.update({
        'stats.sentCount': sent,
        'stats.failedCount': failed,
        errors: errors.slice(0, 100), // Limit to 100 errors to avoid document size issues
      })

      // Rate limit: wait before next batch
      if (i + this.BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY_MS))
      }
    }

    // Mark as complete
    await campaignRef.update({
      status: 'sent',
      sentAt: Timestamp.now(),
    })

    console.log(
      `[CampaignService] Campaign completed: ${campaign.name} (${sent} sent, ${failed} failed)`
    )
  }

  /**
   * Send email to a single user using the campaign template
   */
  private async sendEmailToUser(
    user: CampaignRecipient,
    campaign: EmailCampaign
  ): Promise<void> {
    const emailContent = await this.buildEmailFromTemplate(campaign.template, user, campaign)

    await sendEmail({
      to: user.email,
      subject: campaign.subject,
      html: emailContent.html,
      text: emailContent.text,
      from: 'Moshimoshi <noreply@moshimoshi.app>',
    })
  }

  /**
   * Build email content from template
   */
  private async buildEmailFromTemplate(
    template: EmailCampaign['template'],
    user: CampaignRecipient,
    campaign: EmailCampaign
  ): Promise<{ html: string; text: string }> {
    switch (template) {
      case 'waitlist':
        return buildWaitlistThankYouContent(user.email, 'en')

      case 'welcome':
        // TODO: Implement welcome email template
        return {
          html: `<h1>Welcome to Moshimoshi!</h1><p>Thanks for joining us.</p>`,
          text: `Welcome to Moshimoshi!\n\nThanks for joining us.`,
        }

      case 'custom':
        // For custom emails, use the subject as the content
        // TODO: Add custom HTML/text fields to campaign
        return {
          html: `<h1>${campaign.subject}</h1>`,
          text: campaign.subject,
        }

      default:
        throw new Error(`Unknown template: ${template}`)
    }
  }

  /**
   * Get user email from Firebase Auth
   */
  private async getUserEmail(uid: string): Promise<string | null> {
    if (!adminAuth) {
      throw new Error('Firebase Auth not initialized')
    }

    try {
      const userRecord = await adminAuth.getUser(uid)
      return userRecord.email || null
    } catch (error) {
      console.error(`[CampaignService] Error fetching user email for ${uid}:`, error)
      return null
    }
  }

  /**
   * Check if user's email is verified
   */
  private async isEmailVerified(uid: string): Promise<boolean> {
    if (!adminAuth) {
      throw new Error('Firebase Auth not initialized')
    }

    try {
      const userRecord = await adminAuth.getUser(uid)
      return userRecord.emailVerified
    } catch (error) {
      console.error(`[CampaignService] Error checking email verification for ${uid}:`, error)
      return false
    }
  }

  /**
   * Get user preferences from Firestore
   */
  private async getUserPreferences(uid: string): Promise<any> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    try {
      const prefsDoc = await adminFirestore
        .collection('users')
        .doc(uid)
        .collection('preferences')
        .doc('settings')
        .get()

      return prefsDoc.exists ? prefsDoc.data() : null
    } catch (error) {
      console.error(`[CampaignService] Error fetching preferences for ${uid}:`, error)
      return null
    }
  }
}
