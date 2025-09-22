/**
 * Data Access Object for review_sets collection
 * Handles all CRUD operations for review sets
 */

import { 
  Firestore, 
  CollectionReference, 
  Timestamp,
  FieldValue,
  WriteBatch
} from 'firebase-admin/firestore'
import { adminFirestore } from '../admin'
import { ReviewSetDocument, ContentType } from '../schema/review-collections'

/**
 * Data Access Object for review sets
 */
export class ReviewSetDAO {
  private db: Firestore
  private collection: CollectionReference<ReviewSetDocument>
  
  constructor() {
    if (!adminFirestore) {
      throw new Error('Firebase Admin Firestore not initialized')
    }
    this.db = adminFirestore
    this.collection = this.db.collection('review_sets') as CollectionReference<ReviewSetDocument>
  }
  
  /**
   * Create a new review set
   */
  async create(set: Omit<ReviewSetDocument, 'id'>): Promise<string> {
    try {
      const docRef = await this.collection.add({
        ...set,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastAccessedAt: Timestamp.now()
      } as ReviewSetDocument)
      
      // Update the document with its ID
      await docRef.update({ id: docRef.id })
      
      return docRef.id
    } catch (error) {
      console.error('Error creating review set:', error)
      throw new Error('Failed to create review set')
    }
  }
  
  /**
   * Update an existing review set
   */
  async update(id: string, updates: Partial<ReviewSetDocument>): Promise<void> {
    try {
      const docRef = this.collection.doc(id)
      const doc = await docRef.get()
      
      if (!doc.exists) {
        throw new Error('Review set not found')
      }
      
      await docRef.update({
        ...updates,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error updating review set:', error)
      throw new Error('Failed to update review set')
    }
  }
  
  /**
   * Delete a review set
   */
  async delete(id: string): Promise<void> {
    try {
      // Also remove set ID from all associated review items
      const batch = this.db.batch()
      
      // Delete the set
      batch.delete(this.collection.doc(id))
      
      // Remove set ID from review items
      const reviewItemsSnapshot = await this.db
        .collection('review_items')
        .where('setIds', 'array-contains', id)
        .get()
      
      reviewItemsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          setIds: FieldValue.arrayRemove(id),
          updatedAt: Timestamp.now()
        })
      })
      
      await batch.commit()
    } catch (error) {
      console.error('Error deleting review set:', error)
      throw new Error('Failed to delete review set')
    }
  }
  
  /**
   * Get a single review set by ID
   */
  async get(id: string): Promise<ReviewSetDocument | null> {
    try {
      const doc = await this.collection.doc(id).get()
      
      if (!doc.exists) {
        return null
      }
      
      // Update last accessed time
      await this.collection.doc(id).update({
        lastAccessedAt: Timestamp.now()
      })
      
      return doc.data() as ReviewSetDocument
    } catch (error) {
      console.error('Error getting review set:', error)
      throw new Error('Failed to get review set')
    }
  }
  
  /**
   * Get all review sets for a user
   */
  async getByUser(userId: string): Promise<ReviewSetDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSetDocument)
    } catch (error) {
      console.error('Error getting user review sets:', error)
      throw new Error('Failed to get user review sets')
    }
  }
  
  /**
   * Get public review sets
   */
  async getPublicSets(limit: number = 50): Promise<ReviewSetDocument[]> {
    try {
      const snapshot = await this.collection
        .where('isPublic', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSetDocument)
    } catch (error) {
      console.error('Error getting public sets:', error)
      throw new Error('Failed to get public sets')
    }
  }
  
  /**
   * Get shared sets for a user
   */
  async getSharedSets(userId: string): Promise<ReviewSetDocument[]> {
    try {
      const snapshot = await this.collection
        .where('sharedWith', 'array-contains', userId)
        .orderBy('updatedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSetDocument)
    } catch (error) {
      console.error('Error getting shared sets:', error)
      throw new Error('Failed to get shared sets')
    }
  }
  
  /**
   * Add items to a review set
   */
  async addItems(setId: string, itemIds: string[]): Promise<void> {
    try {
      const setRef = this.collection.doc(setId)
      const set = await setRef.get()
      
      if (!set.exists) {
        throw new Error('Review set not found')
      }
      
      const batch = this.db.batch()
      
      // Update the set
      batch.update(setRef, {
        itemIds: FieldValue.arrayUnion(...itemIds),
        itemCount: FieldValue.increment(itemIds.length),
        updatedAt: Timestamp.now()
      })
      
      // Update review items to include this set
      for (const itemId of itemIds) {
        const itemRef = this.db.collection('review_items').doc(itemId)
        batch.update(itemRef, {
          setIds: FieldValue.arrayUnion(setId),
          updatedAt: Timestamp.now()
        })
      }
      
      await batch.commit()
    } catch (error) {
      console.error('Error adding items to set:', error)
      throw new Error('Failed to add items to set')
    }
  }
  
  /**
   * Remove items from a review set
   */
  async removeItems(setId: string, itemIds: string[]): Promise<void> {
    try {
      const setRef = this.collection.doc(setId)
      const set = await setRef.get()
      
      if (!set.exists) {
        throw new Error('Review set not found')
      }
      
      const batch = this.db.batch()
      
      // Update the set
      batch.update(setRef, {
        itemIds: FieldValue.arrayRemove(...itemIds),
        itemCount: FieldValue.increment(-itemIds.length),
        updatedAt: Timestamp.now()
      })
      
      // Update review items to remove this set
      for (const itemId of itemIds) {
        const itemRef = this.db.collection('review_items').doc(itemId)
        batch.update(itemRef, {
          setIds: FieldValue.arrayRemove(setId),
          updatedAt: Timestamp.now()
        })
      }
      
      await batch.commit()
    } catch (error) {
      console.error('Error removing items from set:', error)
      throw new Error('Failed to remove items from set')
    }
  }
  
  /**
   * Update progress statistics for a set
   */
  async updateProgress(
    setId: string, 
    progress: { new: number; learning: number; mastered: number }
  ): Promise<void> {
    try {
      await this.collection.doc(setId).update({
        progress,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error updating set progress:', error)
      throw new Error('Failed to update set progress')
    }
  }
  
  /**
   * Clone a review set for a user
   */
  async cloneSet(originalSetId: string, userId: string, name?: string): Promise<string> {
    try {
      const original = await this.get(originalSetId)
      
      if (!original) {
        throw new Error('Original set not found')
      }
      
      const clonedSet: Omit<ReviewSetDocument, 'id'> = {
        ...original,
        userId,
        name: name || `${original.name} (Copy)`,
        category: 'custom',
        isPublic: false,
        sharedWith: [],
        originalSetId,
        progress: { new: 0, learning: 0, mastered: 0 },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastAccessedAt: Timestamp.now()
      }
      
      return await this.create(clonedSet)
    } catch (error) {
      console.error('Error cloning set:', error)
      throw new Error('Failed to clone set')
    }
  }
  
  /**
   * Share a set with other users
   */
  async shareWith(setId: string, userIds: string[]): Promise<void> {
    try {
      await this.collection.doc(setId).update({
        sharedWith: FieldValue.arrayUnion(...userIds),
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error sharing set:', error)
      throw new Error('Failed to share set')
    }
  }
  
  /**
   * Unshare a set with users
   */
  async unshareWith(setId: string, userIds: string[]): Promise<void> {
    try {
      await this.collection.doc(setId).update({
        sharedWith: FieldValue.arrayRemove(...userIds),
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error unsharing set:', error)
      throw new Error('Failed to unshare set')
    }
  }
  
  /**
   * Make a set public or private
   */
  async setVisibility(setId: string, isPublic: boolean): Promise<void> {
    try {
      await this.collection.doc(setId).update({
        isPublic,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error updating set visibility:', error)
      throw new Error('Failed to update set visibility')
    }
  }
  
  /**
   * Get sets by category
   */
  async getByCategory(category: 'official' | 'custom' | 'shared'): Promise<ReviewSetDocument[]> {
    try {
      const snapshot = await this.collection
        .where('category', '==', category)
        .orderBy('updatedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSetDocument)
    } catch (error) {
      console.error('Error getting sets by category:', error)
      throw new Error('Failed to get sets by category')
    }
  }
  
  /**
   * Search sets by name or description
   */
  async search(query: string, userId?: string): Promise<ReviewSetDocument[]> {
    try {
      // Note: This is a simple implementation. For better search,
      // consider using Algolia or ElasticSearch
      const lowerQuery = query.toLowerCase()
      let allSets: ReviewSetDocument[] = []
      
      if (userId) {
        // Search user's sets and shared sets
        const userSets = await this.getByUser(userId)
        const sharedSets = await this.getSharedSets(userId)
        allSets = [...userSets, ...sharedSets]
      } else {
        // Search public sets only
        allSets = await this.getPublicSets(100)
      }
      
      return allSets.filter(set => 
        set.name.toLowerCase().includes(lowerQuery) ||
        set.description.toLowerCase().includes(lowerQuery)
      )
    } catch (error) {
      console.error('Error searching sets:', error)
      throw new Error('Failed to search sets')
    }
  }
}