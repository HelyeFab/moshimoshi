/**
 * Email Campaign Service
 *
 * Handles batch sending of email campaigns to segmented users.
 * Core responsibilities:
 * - Query users based on segment criteria
 * - Filter users by email preferences
 * - Check global suppression list (bounces, unsubscribes, complaints)
 * - Send emails in batches with rate limiting
 * - Update campaign status in real-time
 * - Track errors and failures
 */

import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { sendCampaignEmail } from '@/lib/email/campaign-sender'
import { buildWaitlistThankYouContent } from '@/lib/email/waitlistThankYou'
import { suppressionService, generateUnsubscribeUrl } from '@/lib/email/suppression'
import { substituteVariables, buildVariableContext } from '@/lib/email/templates/variables'
import { normalizeCampaignTemplateVariables } from './template-variables'
import type { EmailTemplate } from '@/lib/email/templates/types'
import type {
  EmailCampaign,
  CampaignRecipient,
  CampaignSegment,
} from './types'

export class CampaignService {
  // Resend rate limit: 2 emails per second
  // We send 2 emails, then wait 1 second
  private readonly EMAILS_PER_SECOND = 2
  private readonly RATE_LIMIT_DELAY_MS = 1000

  constructor() {
    ensureAdminInitialized()
  }

  /**
   * Query users based on segment criteria
   * Filters by subscription type, email verification, and marketing preferences
   *
   * OPTIMIZED: Uses batch operations to avoid N+1 query problems
   */
  async getUsersForSegment(
    segment: EmailCampaign['segment']
  ): Promise<CampaignRecipient[]> {
    if (!adminFirestore || !adminAuth) {
      throw new Error('Firebase not initialized')
    }

    // Handle custom emails segment - lookup users by email address
    if (segment.type === 'custom_emails' && segment.customEmails?.length) {
      return this.getUsersByEmails(segment.customEmails, segment)
    }

    // Base query on users collection
    let query: FirebaseFirestore.Query = adminFirestore.collection('users')

    // Filter by subscription type
    if (segment.type === 'premium_monthly') {
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

    // Step 1: Filter by subscription type in memory (for 'free' segment)
    let filteredDocs = snapshot.docs
    if (segment.type === 'free') {
      filteredDocs = snapshot.docs.filter((doc) => {
        const data = doc.data()
        const isPremium =
          data.subscription &&
          (data.subscription.plan === 'premium_monthly' ||
            data.subscription.plan === 'premium_yearly') &&
          (data.subscription.status === 'active' || data.subscription.status === 'trialing')
        return !isPremium
      })
      console.log(`[CampaignService] After free filter: ${filteredDocs.length} users`)
    }

    const uids = filteredDocs.map((doc) => doc.id)
    if (uids.length === 0) {
      return []
    }

    // Step 2: Batch fetch user records from Firebase Auth (100 at a time)
    console.log(`[CampaignService] Fetching ${uids.length} user records from Auth...`)
    const userRecords = await this.batchGetUsers(uids)
    console.log(`[CampaignService] Got ${userRecords.size} user records`)

    // Step 3: Build initial candidate list with emails
    let candidates: { uid: string; email: string; emailVerified: boolean }[] = []
    for (const uid of uids) {
      const userRecord = userRecords.get(uid)
      if (!userRecord?.email) {
        continue
      }
      candidates.push({
        uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
      })
    }

    // Step 4: Filter by email verification if required
    if (segment.emailVerifiedOnly) {
      const beforeCount = candidates.length
      candidates = candidates.filter((c) => c.emailVerified)
      console.log(`[CampaignService] Email verified filter: ${beforeCount} -> ${candidates.length}`)
    }

    if (candidates.length === 0) {
      return []
    }

    // Step 5: Batch check marketing preferences if required
    if (segment.respectMarketingPrefs) {
      const beforeCount = candidates.length
      const prefsMap = await this.batchGetPreferences(candidates.map((c) => c.uid))
      candidates = candidates.filter((c) => {
        const prefs = prefsMap.get(c.uid)
        // Only skip if user explicitly opted OUT (set to false)
        return prefs?.notifications?.marketingEmails !== false
      })
      console.log(`[CampaignService] Marketing prefs filter: ${beforeCount} -> ${candidates.length}`)
    }

    if (candidates.length === 0) {
      return []
    }

    // Step 6: Batch check suppression list
    const emails = candidates.map((c) => c.email)
    console.log(`[CampaignService] Checking ${emails.length} emails against suppression list...`)
    const suppressionResult = await suppressionService.checkBatch(emails)

    const users: CampaignRecipient[] = []
    for (const candidate of candidates) {
      const checkResult = suppressionResult.details.get(candidate.email)
      if (checkResult?.suppressed) {
        continue
      }
      users.push({ uid: candidate.uid, email: candidate.email })
    }

    if (suppressionResult.suppressed.length > 0) {
      console.log(`[CampaignService] Skipped ${suppressionResult.suppressed.length} suppressed emails`)
    }

    console.log(`[CampaignService] Final eligible recipients: ${users.length}`)
    return users
  }

  /**
   * Batch fetch user records from Firebase Auth
   * Firebase allows up to 100 users per batch
   */
  private async batchGetUsers(
    uids: string[]
  ): Promise<Map<string, { email: string | undefined; emailVerified: boolean }>> {
    if (!adminAuth) {
      throw new Error('Firebase Auth not initialized')
    }

    const result = new Map<string, { email: string | undefined; emailVerified: boolean }>()
    const BATCH_SIZE = 100

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = uids.slice(i, i + BATCH_SIZE)
      const identifiers = batch.map((uid) => ({ uid }))

      try {
        const response = await adminAuth.getUsers(identifiers)
        for (const user of response.users) {
          result.set(user.uid, {
            email: user.email,
            emailVerified: user.emailVerified,
          })
        }
      } catch (error) {
        console.error(`[CampaignService] Error batch fetching users:`, error)
      }
    }

    return result
  }

  /**
   * Batch fetch user preferences from Firestore
   */
  private async batchGetPreferences(uids: string[]): Promise<Map<string, any>> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const result = new Map<string, any>()

    // Firestore getAll supports up to 500 documents
    const BATCH_SIZE = 500

    for (let i = 0; i < uids.length; i += BATCH_SIZE) {
      const batch = uids.slice(i, i + BATCH_SIZE)
      const refs = batch.map((uid) =>
        adminFirestore!
          .collection('users')
          .doc(uid)
          .collection('preferences')
          .doc('settings')
      )

      try {
        const snapshots = await adminFirestore.getAll(...refs)
        for (let j = 0; j < snapshots.length; j++) {
          const snap = snapshots[j]
          if (snap.exists) {
            result.set(batch[j], snap.data())
          }
        }
      } catch (error) {
        console.error(`[CampaignService] Error batch fetching preferences:`, error)
      }
    }

    return result
  }

  /**
   * Get users by their email addresses (for custom_emails segment)
   * Looks up users in Firebase Auth and applies suppression filtering
   */
  private async getUsersByEmails(
    emails: string[],
    segment: EmailCampaign['segment']
  ): Promise<CampaignRecipient[]> {
    if (!adminAuth) {
      throw new Error('Firebase Auth not initialized')
    }

    console.log(`[CampaignService] Looking up ${emails.length} custom email addresses...`)

    const users: CampaignRecipient[] = []
    const notFound: string[] = []

    // Look up each email in Firebase Auth
    for (const email of emails) {
      const trimmedEmail = email.trim().toLowerCase()
      if (!trimmedEmail) continue

      try {
        const userRecord = await adminAuth.getUserByEmail(trimmedEmail)

        // Check email verification if required
        if (segment.emailVerifiedOnly && !userRecord.emailVerified) {
          console.log(`[CampaignService] Skipping ${trimmedEmail} - not verified`)
          continue
        }

        users.push({ uid: userRecord.uid, email: trimmedEmail })
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          notFound.push(trimmedEmail)
        } else {
          console.error(`[CampaignService] Error looking up ${trimmedEmail}:`, error)
        }
      }
    }

    if (notFound.length > 0) {
      console.warn(`[CampaignService] ${notFound.length} emails not found in system:`, notFound)
    }

    // Check marketing preferences if required
    if (segment.respectMarketingPrefs && users.length > 0) {
      const prefsMap = await this.batchGetPreferences(users.map((u) => u.uid))
      const filteredUsers = users.filter((u) => {
        const prefs = prefsMap.get(u.uid)
        return prefs?.notifications?.marketingEmails !== false
      })
      console.log(`[CampaignService] Marketing prefs filter: ${users.length} -> ${filteredUsers.length}`)
      users.length = 0
      users.push(...filteredUsers)
    }

    // Check suppression list
    if (users.length > 0) {
      const emailsToCheck = users.map((u) => u.email)
      const suppressionResult = await suppressionService.checkBatch(emailsToCheck)

      const finalUsers = users.filter((u) => {
        const checkResult = suppressionResult.details.get(u.email)
        return !checkResult?.suppressed
      })

      if (suppressionResult.suppressed.length > 0) {
        console.log(`[CampaignService] Skipped ${suppressionResult.suppressed.length} suppressed emails`)
      }

      console.log(`[CampaignService] Final eligible custom recipients: ${finalUsers.length}`)
      return finalUsers
    }

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

    // Send emails respecting Resend's rate limit (2 emails/second)
    let sent = 0
    let failed = 0
    const errors: EmailCampaign['errors'] = []
    const totalUsers = users.length
    const estimatedMinutes = Math.ceil(totalUsers / this.EMAILS_PER_SECOND / 60)

    console.log(
      `[CampaignService] Sending ${totalUsers} emails at ${this.EMAILS_PER_SECOND}/sec (estimated: ${estimatedMinutes} minutes)`
    )

    for (let i = 0; i < users.length; i += this.EMAILS_PER_SECOND) {
      const batch = users.slice(i, i + this.EMAILS_PER_SECOND)

      // Log progress every 50 emails
      if (i % 50 === 0) {
        console.log(
          `[CampaignService] Progress: ${i}/${totalUsers} (${Math.round((i / totalUsers) * 100)}%)`
        )
      }

      // Send this small batch in parallel (2 emails max)
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

      // Update progress in Firestore every 20 emails to reduce writes
      if (i % 20 === 0 || i + this.EMAILS_PER_SECOND >= users.length) {
        await campaignRef.update({
          'stats.sentCount': sent,
          'stats.failedCount': failed,
          errors: errors.slice(0, 100), // Limit to 100 errors to avoid document size issues
        })
      }

      // Rate limit: wait 1 second before next batch of 2
      if (i + this.EMAILS_PER_SECOND < users.length) {
        await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY_MS))
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
   * Includes unsubscribe headers for Gmail/Yahoo compliance
   */
  private async sendEmailToUser(
    user: CampaignRecipient,
    campaign: EmailCampaign
  ): Promise<void> {
    const emailContent = await this.buildEmailFromTemplate(campaign.template, user, campaign)

    // Generate unsubscribe URL for this user
    const unsubscribeUrl = generateUnsubscribeUrl(user.email)
    const normalizedTemplateVariables = normalizeCampaignTemplateVariables(
      campaign.templateVariables
    )

    // Build variable context for subject line substitution
    const variableContext = buildVariableContext(user.email, [], {
      ...normalizedTemplateVariables,
      unsubscribeUrl,
    })

    // Substitute variables in subject line
    const subject = substituteVariables(campaign.subject, variableContext)

    // Append unsubscribe footer to HTML content
    const htmlWithUnsubscribe = this.appendUnsubscribeFooter(
      emailContent.html,
      unsubscribeUrl
    )
    const textWithUnsubscribe = this.appendUnsubscribeFooterText(
      emailContent.text,
      unsubscribeUrl
    )

    await sendCampaignEmail({
      to: user.email,
      subject,
      html: htmlWithUnsubscribe,
      text: textWithUnsubscribe,
      from: 'Moshimoshi <noreply@moshimoshi.app>',
      campaignId: campaign.id,
    })
  }

  /**
   * Append unsubscribe footer to HTML email
   */
  private appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
    const footer = `
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
        <p>
          You're receiving this email because you signed up for Moshimoshi.
        </p>
        <p>
          <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
          from marketing emails
        </p>
      </div>
    `

    // Try to insert before </body>, otherwise append to end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${footer}</body>`)
    }
    return html + footer
  }

  /**
   * Append unsubscribe footer to plain text email
   */
  private appendUnsubscribeFooterText(text: string, unsubscribeUrl: string): string {
    const footer = `

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: ${unsubscribeUrl}
`
    return text + footer
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
        // Use custom template from email_templates collection
        if (campaign.templateId) {
          return this.buildFromCustomTemplate(
            campaign.templateId,
            user,
            campaign
          )
        }
        // Fallback for campaigns without templateId
        return {
          html: `<h1>${campaign.subject}</h1>`,
          text: campaign.subject,
        }

      default:
        throw new Error(`Unknown template: ${template}`)
    }
  }

  /**
   * Build email content from a custom template in email_templates collection
   */
  private async buildFromCustomTemplate(
    templateId: string,
    user: CampaignRecipient,
    campaign: EmailCampaign
  ): Promise<{ html: string; text: string }> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    // Fetch template from Firestore
    const templateDoc = await adminFirestore
      .collection('email_templates')
      .doc(templateId)
      .get()

    if (!templateDoc.exists) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const template = templateDoc.data() as EmailTemplate

    // Build variable context
    const unsubscribeUrl = generateUnsubscribeUrl(user.email)
    const variableContext = buildVariableContext(
      user.email,
      template.variables || [],
      {
        ...normalizeCampaignTemplateVariables(campaign.templateVariables),
        unsubscribeUrl,
      }
    )

    // Substitute variables in template content
    const html = substituteVariables(template.htmlContent, variableContext)
    const text = substituteVariables(template.textContent, variableContext)

    return { html, text }
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
