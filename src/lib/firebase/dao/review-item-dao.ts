/**
 * Data Access Object for review_items collection
 * Handles all CRUD operations for review items
 */

import { 
  Firestore, 
  CollectionReference, 
  DocumentReference,
  Query,
  Timestamp,
  WriteBatch,
  FieldValue
} from 'firebase-admin/firestore'
import { adminFirestore } from '../admin'
import { ReviewItemDocument, toTimestamp, fromTimestamp } from '../schema/review-collections'

/**
 * Data Access Object for review items
 */
export class ReviewItemDAO {
  private db: Firestore
  private collection: CollectionReference<ReviewItemDocument>
  
  constructor() {
    if (!adminFirestore) {
      throw new Error('Firebase Admin Firestore not initialized')
    }
    this.db = adminFirestore
    this.collection = this.db.collection('review_items') as CollectionReference<ReviewItemDocument>
  }
  
  /**
   * Create a new review item
   */
  async create(item: Omit<ReviewItemDocument, 'id'>): Promise<string> {
    try {
      const docRef = await this.collection.add({
        ...item,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        version: 1
      } as ReviewItemDocument)
      
      // Update the document with its ID
      await docRef.update({ id: docRef.id })
      
      return docRef.id
    } catch (error) {
      console.error('Error creating review item:', error)
      throw new Error('Failed to create review item')
    }
  }
  
  /**
   * Update an existing review item
   * Uses optimistic locking with version field
   */
  async update(id: string, updates: Partial<ReviewItemDocument>): Promise<void> {
    try {
      const docRef = this.collection.doc(id)
      const doc = await docRef.get()
      
      if (!doc.exists) {
        throw new Error('Review item not found')
      }
      
      const currentVersion = doc.data()?.version || 0
      
      await docRef.update({
        ...updates,
        updatedAt: Timestamp.now(),
        version: currentVersion + 1
      })
    } catch (error) {
      console.error('Error updating review item:', error)
      throw new Error('Failed to update review item')
    }
  }
  
  /**
   * Delete a review item
   */
  async delete(id: string): Promise<void> {
    try {
      await this.collection.doc(id).delete()
    } catch (error) {
      console.error('Error deleting review item:', error)
      throw new Error('Failed to delete review item')
    }
  }
  
  /**
   * Get a single review item by ID
   */
  async get(id: string): Promise<ReviewItemDocument | null> {
    try {
      const doc = await this.collection.doc(id).get()
      
      if (!doc.exists) {
        return null
      }
      
      return doc.data() as ReviewItemDocument
    } catch (error) {
      console.error('Error getting review item:', error)
      throw new Error('Failed to get review item')
    }
  }
  
  /**
   * Get all review items for a user
   */
  async getByUser(userId: string): Promise<ReviewItemDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .orderBy('srsData.nextReviewAt', 'asc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewItemDocument)
    } catch (error) {
      console.error('Error getting user review items:', error)
      throw new Error('Failed to get user review items')
    }
  }
  
  /**
   * Get due review items for a user
   */
  async getDueItems(userId: string, before?: Date): Promise<ReviewItemDocument[]> {
    try {
      const beforeTimestamp = before ? toTimestamp(before) : Timestamp.now()
      
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .where('srsData.nextReviewAt', '<=', beforeTimestamp)
        .orderBy('srsData.nextReviewAt', 'asc')
        .orderBy('priority', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewItemDocument)
    } catch (error) {
      console.error('Error getting due items:', error)
      throw new Error('Failed to get due items')
    }
  }
  
  /**
   * Get review items by status
   */
  async getByStatus(userId: string, status: 'new' | 'learning' | 'mastered'): Promise<ReviewItemDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('status', '==', status)
        .where('isActive', '==', true)
        .orderBy('updatedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewItemDocument)
    } catch (error) {
      console.error('Error getting items by status:', error)
      throw new Error('Failed to get items by status')
    }
  }
  
  /**
   * Get review items by set ID
   */
  async getBySet(userId: string, setId: string): Promise<ReviewItemDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('setIds', 'array-contains', setId)
        .where('isActive', '==', true)
        .orderBy('srsData.nextReviewAt', 'asc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewItemDocument)
    } catch (error) {
      console.error('Error getting items by set:', error)
      throw new Error('Failed to get items by set')
    }
  }
  
  /**
   * Bulk create review items
   * Uses batched writes for efficiency
   */
  async bulkCreate(items: Omit<ReviewItemDocument, 'id'>[]): Promise<string[]> {
    try {
      const batch = this.db.batch()
      const ids: string[] = []
      const now = Timestamp.now()
      
      for (const item of items) {
        const docRef = this.collection.doc()
        ids.push(docRef.id)
        
        batch.set(docRef, {
          ...item,
          id: docRef.id,
          createdAt: now,
          updatedAt: now,
          version: 1
        } as ReviewItemDocument)
      }
      
      await batch.commit()
      return ids
    } catch (error) {
      console.error('Error bulk creating review items:', error)
      throw new Error('Failed to bulk create review items')
    }
  }
  
  /**
   * Bulk update review items
   * Uses batched writes for efficiency
   */
  async bulkUpdate(updates: Map<string, Partial<ReviewItemDocument>>): Promise<void> {
    try {
      const batch = this.db.batch()
      const now = Timestamp.now()
      
      for (const [id, update] of updates) {
        const docRef = this.collection.doc(id)
        batch.update(docRef, {
          ...update,
          updatedAt: now,
          version: FieldValue.increment(1)
        })
      }
      
      await batch.commit()
    } catch (error) {
      console.error('Error bulk updating review items:', error)
      throw new Error('Failed to bulk update review items')
    }
  }
  
  /**
   * Get pinned items for a user
   */
  async getPinnedItems(userId: string): Promise<ReviewItemDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .where('pinnedAt', '!=', null)
        .orderBy('pinnedAt', 'desc')
        .orderBy('priority', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewItemDocument)
    } catch (error) {
      console.error('Error getting pinned items:', error)
      throw new Error('Failed to get pinned items')
    }
  }
  
  /**
   * Update SRS data after review
   */
  async updateSRSData(
    id: string, 
    srsData: Partial<ReviewItemDocument['srsData']>,
    stats?: {
      correct?: boolean
      responseTime?: number
    }
  ): Promise<void> {
    try {
      const updates: any = {
        'srsData.interval': srsData.interval,
        'srsData.easeFactor': srsData.easeFactor,
        'srsData.repetitions': srsData.repetitions,
        'srsData.lastReviewedAt': srsData.lastReviewedAt,
        'srsData.nextReviewAt': srsData.nextReviewAt,
        reviewCount: FieldValue.increment(1),
        updatedAt: Timestamp.now(),
        version: FieldValue.increment(1)
      }
      
      if (stats?.correct !== undefined) {
        if (stats.correct) {
          updates.correctCount = FieldValue.increment(1)
          updates.streak = FieldValue.increment(1)
        } else {
          updates.incorrectCount = FieldValue.increment(1)
          updates.streak = 0
        }
      }
      
      if (stats?.responseTime !== undefined) {
        // Update average response time
        const doc = await this.collection.doc(id).get()
        if (doc.exists) {
          const data = doc.data() as ReviewItemDocument
          const currentAvg = data.averageResponseTime || 0
          const count = data.reviewCount || 0
          const newAvg = (currentAvg * count + stats.responseTime) / (count + 1)
          updates.averageResponseTime = Math.round(newAvg)
        }
      }
      
      await this.collection.doc(id).update(updates)
    } catch (error) {
      console.error('Error updating SRS data:', error)
      throw new Error('Failed to update SRS data')
    }
  }
  
  /**
   * Check if an item exists for a user
   */
  async exists(userId: string, contentType: string, contentId: string): Promise<boolean> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('contentType', '==', contentType)
        .where('contentId', '==', contentId)
        .limit(1)
        .get()
      
      return !snapshot.empty
    } catch (error) {
      console.error('Error checking item existence:', error)
      throw new Error('Failed to check item existence')
    }
  }
  
  /**
   * Get statistics for a user
   */
  async getUserStatistics(userId: string): Promise<{
    total: number
    new: number
    learning: number
    mastered: number
    dueToday: number
  }> {
    try {
      const items = await this.getByUser(userId)
      const now = Timestamp.now()
      
      return {
        total: items.length,
        new: items.filter(i => i.status === 'new').length,
        learning: items.filter(i => i.status === 'learning').length,
        mastered: items.filter(i => i.status === 'mastered').length,
        dueToday: items.filter(i => i.srsData.nextReviewAt <= now).length
      }
    } catch (error) {
      console.error('Error getting user statistics:', error)
      throw new Error('Failed to get user statistics')
    }
  }
}