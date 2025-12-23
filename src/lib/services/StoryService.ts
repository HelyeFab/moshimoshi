/**
 * Story Service
 * Handles all story-related database operations
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  serverTimestamp,
  deleteDoc,
  Timestamp,
  Firestore,
  documentId,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Story, StoryProgress, StoryStats, StoryBookmark } from '@/types/story'
import { JLPTLevel, AIStoryDraft } from '@/types/ai-story'

// Helper to get non-null db instance
function getDb(): Firestore {
  if (!db) {
    throw new Error('Firestore database not initialized')
  }
  return db
}

class StoryService {
  private readonly STORIES_COLLECTION = 'stories'
  private readonly PROGRESS_COLLECTION = 'storyProgress'
  private readonly BOOKMARKS_COLLECTION = 'storyBookmarks'
  private readonly DRAFTS_COLLECTION = 'aiStoryDrafts'
  private readonly STATS_COLLECTION = 'userStats'

  // ============== Story Management ==============

  /**
   * Create or update a story (admin only)
   */
  async saveStory(story: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const storyId = story.slug || doc(collection(getDb(), this.STORIES_COLLECTION)).id
      const storyRef = doc(getDb(), this.STORIES_COLLECTION, storyId)

      const storyData = {
        ...story,
        id: storyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        viewCount: story.viewCount || 0,
        completionCount: story.completionCount || 0,
      }

      await setDoc(storyRef, storyData)
      return storyId
    } catch (error) {
      console.error('Error saving story:', error)
      throw error
    }
  }

  /**
   * Update an existing story
   */
  async updateStory(storyId: string, updates: Partial<Story>): Promise<void> {
    try {
      const storyRef = doc(getDb(), this.STORIES_COLLECTION, storyId)
      await updateDoc(storyRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      })
    } catch (error) {
      console.error('Error updating story:', error)
      throw error
    }
  }

  /**
   * Get a single story by ID (only published stories for regular users)
   */
  async getStory(storyId: string): Promise<Story | null> {
    try {
      // Use query with documentId and status filter to comply with Firestore rules
      const q = query(
        collection(getDb(), this.STORIES_COLLECTION),
        where(documentId(), '==', storyId),
        where('status', '==', 'published'),
        limit(1)
      )

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return null
      }

      const storyDoc = querySnapshot.docs[0]
      return this.formatStoryData(storyDoc.data(), storyDoc.id)
    } catch (error) {
      console.error('Error getting story:', error)
      throw error
    }
  }

  /**
   * Get a story by slug (only published stories)
   */
  async getStoryBySlug(slug: string): Promise<Story | null> {
    try {
      const q = query(
        collection(getDb(), this.STORIES_COLLECTION),
        where('slug', '==', slug),
        where('status', '==', 'published'),
        limit(1)
      )

      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return null
      }

      const doc = querySnapshot.docs[0]
      return this.formatStoryData(doc.data(), doc.id)
    } catch (error) {
      console.error('Error getting story by slug:', error)
      throw error
    }
  }

  /**
   * Get stories by JLPT level
   */
  async getStoriesByLevel(level: JLPTLevel, limitCount: number = 20): Promise<Story[]> {
    try {
      const q = query(
        collection(getDb(), this.STORIES_COLLECTION),
        where('jlptLevel', '==', level),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => this.formatStoryData(doc.data(), doc.id))
    } catch (error) {
      console.error('Error getting stories by level:', error)
      throw error
    }
  }

  /**
   * Get all published stories
   */
  async getAllStories(limitCount: number = 50): Promise<Story[]> {
    try {
      const q = query(
        collection(getDb(), this.STORIES_COLLECTION),
        where('status', '==', 'published'),
        orderBy('publishedAt', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => this.formatStoryData(doc.data(), doc.id))
    } catch (error) {
      console.error('Error getting all stories:', error)
      throw error
    }
  }

  /**
   * Get stories for admin dashboard
   */
  async getAdminStories(limitCount: number = 100): Promise<Story[]> {
    try {
      const q = query(
        collection(getDb(), this.STORIES_COLLECTION),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => this.formatStoryData(doc.data(), doc.id))
    } catch (error) {
      console.error('Error getting admin stories:', error)
      throw error
    }
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string): Promise<void> {
    try {
      const storyRef = doc(getDb(), this.STORIES_COLLECTION, storyId)
      await deleteDoc(storyRef)
    } catch (error) {
      console.error('Error deleting story:', error)
      throw error
    }
  }

  /**
   * Increment story view count
   */
  async incrementViewCount(storyId: string): Promise<void> {
    try {
      const storyRef = doc(getDb(), this.STORIES_COLLECTION, storyId)
      await updateDoc(storyRef, {
        viewCount: increment(1),
      })
    } catch (error) {
      console.error('Error incrementing view count:', error)
      // Don't throw, just log - this is not critical
    }
  }

  /**
   * Increment story completion count
   */
  async incrementCompletionCount(storyId: string): Promise<void> {
    try {
      const storyRef = doc(getDb(), this.STORIES_COLLECTION, storyId)
      await updateDoc(storyRef, {
        completionCount: increment(1),
      })
    } catch (error) {
      console.error('Error incrementing completion count:', error)
      // Don't throw, just log - this is not critical
    }
  }

  // ============== Progress Management ==============

  /**
   * Get user's progress for a story
   */
  async getStoryProgress(userId: string, storyId: string): Promise<StoryProgress | null> {
    try {
      const progressRef = doc(getDb(), this.PROGRESS_COLLECTION, `${userId}_${storyId}`)
      const progressDoc = await getDoc(progressRef)

      if (!progressDoc.exists()) {
        return null
      }

      const data = progressDoc.data()
      return {
        ...data,
        lastReadAt: data.lastReadAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as StoryProgress
    } catch (error) {
      console.error('Error getting story progress:', error)
      throw error
    }
  }

  /**
   * Save user's progress for a story
   */
  async saveStoryProgress(progress: StoryProgress): Promise<void> {
    try {
      const progressRef = doc(
        getDb(),
        this.PROGRESS_COLLECTION,
        `${progress.userId}_${progress.storyId}`
      )

      // Filter out undefined values to avoid Firestore errors
      const cleanProgress: Record<string, any> = {}
      Object.entries(progress).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanProgress[key] = value
        }
      })

      await setDoc(
        progressRef,
        {
          ...cleanProgress,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    } catch (error) {
      console.error('Error saving story progress:', error)
      throw error
    }
  }

  /**
   * Get all story progress for a user
   */
  async getUserStoryProgress(userId: string): Promise<StoryProgress[]> {
    try {
      const q = query(
        collection(getDb(), this.PROGRESS_COLLECTION),
        where('userId', '==', userId),
        orderBy('lastReadAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          ...data,
          lastReadAt: data.lastReadAt?.toDate() || new Date(),
          completedAt: data.completedAt?.toDate(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as StoryProgress
      })
    } catch (error) {
      console.error('Error getting user story progress:', error)
      throw error
    }
  }

  // ============== Bookmarks Management ==============

  /**
   * Add a bookmark
   */
  async addBookmark(
    bookmark: Omit<StoryBookmark, 'id' | 'bookmarkedAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const bookmarkId = doc(collection(getDb(), this.BOOKMARKS_COLLECTION)).id
      const bookmarkRef = doc(getDb(), this.BOOKMARKS_COLLECTION, bookmarkId)

      await setDoc(bookmarkRef, {
        ...bookmark,
        id: bookmarkId,
        bookmarkedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      return bookmarkId
    } catch (error) {
      console.error('Error adding bookmark:', error)
      throw error
    }
  }

  /**
   * Get user's bookmarks
   */
  async getUserBookmarks(userId: string): Promise<StoryBookmark[]> {
    try {
      const q = query(
        collection(getDb(), this.BOOKMARKS_COLLECTION),
        where('userId', '==', userId),
        orderBy('bookmarkedAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          ...data,
          bookmarkedAt: data.bookmarkedAt?.toDate() || new Date(),
          lastReadAt: data.lastReadAt?.toDate(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as StoryBookmark
      })
    } catch (error) {
      console.error('Error getting user bookmarks:', error)
      throw error
    }
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(bookmarkId: string): Promise<void> {
    try {
      const bookmarkRef = doc(getDb(), this.BOOKMARKS_COLLECTION, bookmarkId)
      await deleteDoc(bookmarkRef)
    } catch (error) {
      console.error('Error removing bookmark:', error)
      throw error
    }
  }

  // ============== AI Story Drafts ==============

  /**
   * Save an AI story draft
   */
  async saveAIDraft(draft: Omit<AIStoryDraft, 'id'>): Promise<string> {
    try {
      const draftId = doc(collection(getDb(), this.DRAFTS_COLLECTION)).id
      const draftRef = doc(getDb(), this.DRAFTS_COLLECTION, draftId)

      await setDoc(draftRef, {
        ...draft,
        id: draftId,
        metadata: {
          ...draft.metadata,
          generatedAt: serverTimestamp(),
        },
      })

      return draftId
    } catch (error) {
      console.error('Error saving AI draft:', error)
      throw error
    }
  }

  /**
   * Get AI story draft
   */
  async getAIDraft(draftId: string): Promise<AIStoryDraft | null> {
    try {
      const draftRef = doc(getDb(), this.DRAFTS_COLLECTION, draftId)
      const draftDoc = await getDoc(draftRef)

      if (!draftDoc.exists()) {
        return null
      }

      const data = draftDoc.data()
      return {
        ...data,
        id: draftDoc.id,
        metadata: {
          ...data.metadata,
          generatedAt: data.metadata?.generatedAt?.toDate() || new Date(),
        },
      } as AIStoryDraft
    } catch (error) {
      console.error('Error getting AI draft:', error)
      throw error
    }
  }

  /**
   * Update AI draft status
   */
  async updateAIDraftStatus(
    draftId: string,
    status: AIStoryDraft['status'],
    error?: string
  ): Promise<void> {
    try {
      const draftRef = doc(getDb(), this.DRAFTS_COLLECTION, draftId)
      const updates: any = { status }
      if (error) {
        updates.error = error
      }
      await updateDoc(draftRef, updates)
    } catch (error) {
      console.error('Error updating AI draft status:', error)
      throw error
    }
  }

  // ============== Stats Management ==============

  /**
   * Get user's story stats
   */
  async getUserStoryStats(userId: string): Promise<StoryStats> {
    try {
      const statsRef = doc(getDb(), this.STATS_COLLECTION, userId)
      const statsDoc = await getDoc(statsRef)

      if (!statsDoc.exists()) {
        return {
          totalStoriesRead: 0,
          storiesReadToday: 0,
          lastStoryDate: '',
          favoriteThemes: [],
          averageQuizScore: 0,
          savedWordsFromStories: 0,
        }
      }

      const data = statsDoc.data()
      return {
        totalStoriesRead: data.totalStoriesRead || 0,
        storiesReadToday: data.storiesReadToday || 0,
        lastStoryDate: data.lastStoryDate || '',
        favoriteThemes: data.favoriteThemes || [],
        averageQuizScore: data.averageQuizScore || 0,
        savedWordsFromStories: data.savedWordsFromStories || 0,
      }
    } catch (error) {
      console.error('Error getting user story stats:', error)
      throw error
    }
  }

  /**
   * Update user's story stats
   */
  async updateUserStoryStats(userId: string, updates: Partial<StoryStats>): Promise<void> {
    try {
      const statsRef = doc(getDb(), this.STATS_COLLECTION, userId)
      await setDoc(statsRef, updates, { merge: true })
    } catch (error) {
      console.error('Error updating user story stats:', error)
      throw error
    }
  }

  // ============== Helper Methods ==============

  /**
   * Format story data from Firestore
   */
  private formatStoryData(data: any, id: string): Story {
    const safeDate = (d: any) =>
      d ? (typeof d.toDate === 'function' ? d.toDate() : new Date(d)) : undefined

    return {
      ...data,
      id: id,
      createdAt: safeDate(data.createdAt) || new Date(),
      updatedAt: safeDate(data.updatedAt) || new Date(),
      publishedAt: safeDate(data.publishedAt),
    } as Story
  }
}

// Export singleton instance
export const storyService = new StoryService()
