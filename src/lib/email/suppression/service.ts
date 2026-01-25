/**
 * Email Suppression Service
 *
 * Manages the global email suppression list in Firestore.
 * Handles unsubscribes, bounces, and complaints.
 */

import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { hashEmail } from './tokens'
import type {
  EmailSuppression,
  SuppressionReason,
  SuppressionSource,
  SuppressionCheckResult,
  BatchSuppressionResult,
} from './types'

const COLLECTION_NAME = 'email_suppressions'

/**
 * Email Suppression Service
 * Singleton pattern for efficient reuse
 */
export class SuppressionService {
  private static instance: SuppressionService

  private constructor() {
    ensureAdminInitialized()
  }

  static getInstance(): SuppressionService {
    if (!this.instance) {
      this.instance = new SuppressionService()
    }
    return this.instance
  }

  /**
   * Check if an email is suppressed
   *
   * @param email - Email address to check
   * @returns Suppression check result
   */
  async isEmailSuppressed(email: string): Promise<SuppressionCheckResult> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    try {
      const emailHash = hashEmail(email)
      const docRef = adminFirestore.collection(COLLECTION_NAME).doc(emailHash)
      const doc = await docRef.get()

      if (!doc.exists) {
        return { suppressed: false }
      }

      const data = doc.data() as EmailSuppression
      return {
        suppressed: true,
        reason: data.reason,
        suppressedAt: data.suppressedAt?.toDate(),
      }
    } catch (error) {
      console.error('[SuppressionService] Error checking suppression:', error)
      // Fail open - if we can't check, don't suppress
      // This prevents legitimate emails from being blocked on database errors
      return { suppressed: false }
    }
  }

  /**
   * Check multiple emails for suppression (batch operation)
   * More efficient than checking one by one
   *
   * @param emails - Array of email addresses
   * @returns Batch suppression result
   */
  async checkBatch(emails: string[]): Promise<BatchSuppressionResult> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const result: BatchSuppressionResult = {
      suppressed: [],
      allowed: [],
      details: new Map(),
    }

    if (emails.length === 0) {
      return result
    }

    try {
      // Firestore 'in' queries support max 30 items
      // For larger batches, we need to chunk
      const BATCH_SIZE = 30
      const emailHashes = emails.map((e) => hashEmail(e))
      const emailToHash = new Map(emails.map((e, i) => [emailHashes[i], e]))

      for (let i = 0; i < emailHashes.length; i += BATCH_SIZE) {
        const chunk = emailHashes.slice(i, i + BATCH_SIZE)

        const snapshot = await adminFirestore
          .collection(COLLECTION_NAME)
          .where('emailHash', 'in', chunk)
          .get()

        // Mark found emails as suppressed
        for (const doc of snapshot.docs) {
          const data = doc.data() as EmailSuppression
          const email = data.email

          result.suppressed.push(email)
          result.details.set(email, {
            suppressed: true,
            reason: data.reason,
            suppressedAt: data.suppressedAt?.toDate(),
          })
        }
      }

      // Mark remaining emails as allowed
      for (const email of emails) {
        if (!result.details.has(email)) {
          result.allowed.push(email)
          result.details.set(email, { suppressed: false })
        }
      }

      return result
    } catch (error) {
      console.error('[SuppressionService] Error in batch check:', error)
      // Fail open - allow all emails if database error
      return {
        suppressed: [],
        allowed: emails,
        details: new Map(emails.map((e) => [e, { suppressed: false }])),
      }
    }
  }

  /**
   * Add an email to the suppression list
   *
   * @param email - Email address to suppress
   * @param reason - Why the email is being suppressed
   * @param source - How the suppression was triggered
   * @param metadata - Optional additional data
   */
  async addSuppression(
    email: string,
    reason: SuppressionReason,
    source: SuppressionSource,
    metadata?: EmailSuppression['metadata']
  ): Promise<void> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const normalizedEmail = email.toLowerCase().trim()
    const emailHash = hashEmail(normalizedEmail)

    const suppression: EmailSuppression = {
      email: normalizedEmail,
      emailHash,
      reason,
      source,
      suppressedAt: Timestamp.now(),
      metadata,
    }

    try {
      await adminFirestore
        .collection(COLLECTION_NAME)
        .doc(emailHash)
        .set(suppression)

      console.log(
        `[SuppressionService] Added suppression: ${normalizedEmail} (${reason}/${source})`
      )

      // Also update user preferences if user exists
      await this.updateUserPreferencesIfExists(normalizedEmail)
    } catch (error) {
      console.error('[SuppressionService] Error adding suppression:', error)
      throw error
    }
  }

  /**
   * Remove an email from the suppression list (re-subscribe)
   * Use with caution - typically only for manual admin actions
   *
   * @param email - Email address to remove from suppression
   * @returns True if suppression was removed, false if not found
   */
  async removeSuppression(email: string): Promise<boolean> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const emailHash = hashEmail(email)

    try {
      const docRef = adminFirestore.collection(COLLECTION_NAME).doc(emailHash)
      const doc = await docRef.get()

      if (!doc.exists) {
        return false
      }

      await docRef.delete()
      console.log(`[SuppressionService] Removed suppression for: ${email}`)
      return true
    } catch (error) {
      console.error('[SuppressionService] Error removing suppression:', error)
      throw error
    }
  }

  /**
   * Get suppression details for an email
   *
   * @param email - Email address
   * @returns Suppression record or null
   */
  async getSuppression(email: string): Promise<EmailSuppression | null> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    const emailHash = hashEmail(email)

    try {
      const doc = await adminFirestore
        .collection(COLLECTION_NAME)
        .doc(emailHash)
        .get()

      if (!doc.exists) {
        return null
      }

      return doc.data() as EmailSuppression
    } catch (error) {
      console.error('[SuppressionService] Error getting suppression:', error)
      return null
    }
  }

  /**
   * Update user's notification preferences when they unsubscribe
   * This keeps the user document in sync with the suppression list
   *
   * @param email - Email address
   */
  private async updateUserPreferencesIfExists(email: string): Promise<void> {
    if (!adminFirestore) return

    try {
      // Find user by email
      const usersSnapshot = await adminFirestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get()

      if (usersSnapshot.empty) {
        // No user with this email - that's fine, suppression list still works
        return
      }

      const userDoc = usersSnapshot.docs[0]
      const userId = userDoc.id

      // Update preferences subcollection
      const prefsRef = adminFirestore
        .collection('users')
        .doc(userId)
        .collection('preferences')
        .doc('settings')

      // "All or nothing" approach - disable all marketing-related emails
      await prefsRef.set(
        {
          notifications: {
            marketingEmails: false,
            weeklyProgress: false,
            // Keep transactional emails enabled - user can disable these separately
            // dailyReminder: stays as-is (study reminder)
            // achievementAlerts: stays as-is (in-app related)
          },
          updatedAt: Timestamp.now(),
          updatedBy: 'unsubscribe_system',
        },
        { merge: true }
      )

      console.log(
        `[SuppressionService] Updated user preferences for: ${userId}`
      )
    } catch (error) {
      // Log but don't fail - suppression list is the source of truth
      console.error(
        '[SuppressionService] Error updating user preferences:',
        error
      )
    }
  }

  /**
   * Get suppression statistics
   * Useful for admin dashboard
   */
  async getStats(): Promise<{
    total: number
    byReason: Record<SuppressionReason, number>
    last24Hours: number
    last7Days: number
  }> {
    if (!adminFirestore) {
      throw new Error('Firestore not initialized')
    }

    try {
      const snapshot = await adminFirestore.collection(COLLECTION_NAME).get()

      const stats = {
        total: snapshot.size,
        byReason: {
          unsubscribe: 0,
          bounce: 0,
          complaint: 0,
          manual: 0,
          invalid: 0,
        } as Record<SuppressionReason, number>,
        last24Hours: 0,
        last7Days: 0,
      }

      const now = Date.now()
      const oneDayAgo = now - 24 * 60 * 60 * 1000
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

      for (const doc of snapshot.docs) {
        const data = doc.data() as EmailSuppression
        stats.byReason[data.reason]++

        const suppressedAt = data.suppressedAt?.toMillis() || 0
        if (suppressedAt > oneDayAgo) stats.last24Hours++
        if (suppressedAt > sevenDaysAgo) stats.last7Days++
      }

      return stats
    } catch (error) {
      console.error('[SuppressionService] Error getting stats:', error)
      throw error
    }
  }
}

// Export singleton instance
export const suppressionService = SuppressionService.getInstance()
