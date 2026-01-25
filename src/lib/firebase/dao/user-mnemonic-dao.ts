/**
 * Data Access Object for user_mnemonics and mnemonic_regenerations collections
 * Handles user-created mnemonics and regeneration rate limiting
 */

import {
  Firestore,
  CollectionReference,
  Timestamp,
} from 'firebase-admin/firestore'
import { adminFirestore } from '../admin'
import { UserMnemonicDocument, MnemonicRegenerationDocument } from '../schema/review-collections'

/** Maximum regenerations per kanji per day */
const MAX_REGENERATIONS_PER_DAY = 3

/**
 * Get current date in YYYY-MM-DD format (UTC)
 */
function getUTCDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get next midnight UTC timestamp
 */
function getNextMidnightUTC(): Date {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(0, 0, 0, 0)
  return tomorrow
}

/**
 * Data Access Object for user mnemonics
 */
export class UserMnemonicDAO {
  private db: Firestore
  private mnemonicsCollection: CollectionReference<UserMnemonicDocument>
  private regenerationsCollection: CollectionReference<MnemonicRegenerationDocument>

  constructor() {
    console.log('[UserMnemonicDAO] Constructor called, adminFirestore:', !!adminFirestore)
    if (!adminFirestore) {
      console.error('[UserMnemonicDAO] Firebase Admin Firestore not initialized!')
      throw new Error('Firebase Admin Firestore not initialized')
    }
    this.db = adminFirestore
    this.mnemonicsCollection = this.db.collection('user_mnemonics') as CollectionReference<UserMnemonicDocument>
    this.regenerationsCollection = this.db.collection('mnemonic_regenerations') as CollectionReference<MnemonicRegenerationDocument>
    console.log('[UserMnemonicDAO] Initialized successfully')
  }

  /**
   * Get user's mnemonic for a specific kanji
   */
  async get(userId: string, kanji: string): Promise<UserMnemonicDocument | null> {
    console.log('[UserMnemonicDAO] get() called:', { userId: userId.substring(0, 8) + '...', kanji })
    try {
      console.log('[UserMnemonicDAO] Querying user_mnemonics collection...')
      const snapshot = await this.mnemonicsCollection
        .where('userId', '==', userId)
        .where('kanji', '==', kanji)
        .limit(1)
        .get()

      console.log('[UserMnemonicDAO] Query complete, empty:', snapshot.empty)

      if (snapshot.empty) {
        return null
      }

      return snapshot.docs[0].data() as UserMnemonicDocument
    } catch (error) {
      console.error('[UserMnemonicDAO] Error getting mnemonic:', error)
      throw new Error('Failed to get user mnemonic')
    }
  }

  /**
   * Create or update user's mnemonic for a kanji
   */
  async upsert(
    userId: string,
    kanji: string,
    mnemonic: string,
    isPublic: boolean = false
  ): Promise<string> {
    try {
      // Check if mnemonic already exists
      const existing = await this.get(userId, kanji)

      if (existing) {
        // Update existing
        const docRef = this.mnemonicsCollection.doc(existing.id)
        await docRef.update({
          mnemonic,
          isPublic,
          updatedAt: Timestamp.now(),
          version: (existing.version || 0) + 1,
        })
        return existing.id
      }

      // Create new
      const docRef = this.mnemonicsCollection.doc()
      const newDoc: UserMnemonicDocument = {
        id: docRef.id,
        userId,
        kanji,
        mnemonic,
        isPublic,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        version: 1,
      }
      await docRef.set(newDoc)
      return docRef.id
    } catch (error) {
      console.error('[UserMnemonicDAO] Error upserting mnemonic:', error)
      throw new Error('Failed to save user mnemonic')
    }
  }

  /**
   * Delete user's mnemonic for a kanji
   */
  async delete(userId: string, kanji: string): Promise<boolean> {
    try {
      const existing = await this.get(userId, kanji)
      if (!existing) {
        return false
      }

      await this.mnemonicsCollection.doc(existing.id).delete()
      return true
    } catch (error) {
      console.error('[UserMnemonicDAO] Error deleting mnemonic:', error)
      throw new Error('Failed to delete user mnemonic')
    }
  }

  /**
   * Get all mnemonics for a user
   */
  async getAllForUser(userId: string): Promise<UserMnemonicDocument[]> {
    try {
      const snapshot = await this.mnemonicsCollection
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get()

      return snapshot.docs.map(doc => doc.data() as UserMnemonicDocument)
    } catch (error) {
      console.error('[UserMnemonicDAO] Error getting all mnemonics:', error)
      throw new Error('Failed to get user mnemonics')
    }
  }

  /**
   * Check if user can regenerate a mnemonic for a specific kanji
   * Returns remaining regenerations and reset time
   */
  async checkRegenerationLimit(userId: string, kanji: string): Promise<{
    allowed: boolean
    remaining: number
    resetAtUtc: Date
  }> {
    console.log('[UserMnemonicDAO] checkRegenerationLimit called:', { userId: userId.substring(0, 8) + '...', kanji })
    try {
      const dateStr = getUTCDateString()
      const docId = `${userId}_${dateStr}`
      console.log('[UserMnemonicDAO] Fetching doc:', docId)
      const docRef = this.regenerationsCollection.doc(docId)
      console.log('[UserMnemonicDAO] Calling docRef.get()...')
      const doc = await docRef.get()
      console.log('[UserMnemonicDAO] Doc fetched, exists:', doc.exists)

      const resetAtUtc = getNextMidnightUTC()

      if (!doc.exists) {
        console.log('[UserMnemonicDAO] No existing doc, returning max regenerations')
        return {
          allowed: true,
          remaining: MAX_REGENERATIONS_PER_DAY,
          resetAtUtc,
        }
      }

      const data = doc.data() as MnemonicRegenerationDocument
      const kanjiRegens = data.kanjiRegenerations?.[kanji]
      console.log('[UserMnemonicDAO] Kanji regenerations:', kanjiRegens)

      if (!kanjiRegens) {
        return {
          allowed: true,
          remaining: MAX_REGENERATIONS_PER_DAY,
          resetAtUtc,
        }
      }

      const remaining = Math.max(0, MAX_REGENERATIONS_PER_DAY - kanjiRegens.count)
      console.log('[UserMnemonicDAO] Returning remaining:', remaining)
      return {
        allowed: remaining > 0,
        remaining,
        resetAtUtc,
      }
    } catch (error) {
      console.error('[UserMnemonicDAO] Error checking regeneration limit:', error)
      throw new Error('Failed to check regeneration limit')
    }
  }

  /**
   * Increment the regeneration count for a specific kanji
   * Should be called after successful regeneration
   */
  async incrementRegeneration(userId: string, kanji: string): Promise<{
    remaining: number
    resetAtUtc: Date
  }> {
    try {
      const dateStr = getUTCDateString()
      const docId = `${userId}_${dateStr}`
      const docRef = this.regenerationsCollection.doc(docId)
      const doc = await docRef.get()

      const now = Timestamp.now()
      const resetAtUtc = getNextMidnightUTC()

      if (!doc.exists) {
        // Create new tracking document
        const newDoc: MnemonicRegenerationDocument = {
          id: docId,
          userId,
          kanjiRegenerations: {
            [kanji]: {
              count: 1,
              lastRegeneratedAt: now,
            },
          },
          date: dateStr,
          updatedAt: now,
        }
        await docRef.set(newDoc)
        return {
          remaining: MAX_REGENERATIONS_PER_DAY - 1,
          resetAtUtc,
        }
      }

      // Update existing document
      const data = doc.data() as MnemonicRegenerationDocument
      const currentCount = data.kanjiRegenerations?.[kanji]?.count || 0
      const newCount = currentCount + 1

      await docRef.update({
        [`kanjiRegenerations.${kanji}`]: {
          count: newCount,
          lastRegeneratedAt: now,
        },
        updatedAt: now,
      })

      return {
        remaining: Math.max(0, MAX_REGENERATIONS_PER_DAY - newCount),
        resetAtUtc,
      }
    } catch (error) {
      console.error('[UserMnemonicDAO] Error incrementing regeneration:', error)
      throw new Error('Failed to track regeneration')
    }
  }
}
