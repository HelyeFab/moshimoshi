/**
 * Data Access Object for review_sessions collection
 * Handles all CRUD operations for review sessions
 */

import { 
  Firestore, 
  CollectionReference, 
  Timestamp,
  Query
} from 'firebase-admin/firestore'
import { adminFirestore } from '../admin'
import { 
  ReviewSessionDocument, 
  ReviewItemResult,
  SessionType,
  DeviceType 
} from '../schema/review-collections'

/**
 * Data Access Object for review sessions
 */
export class ReviewSessionDAO {
  private db: Firestore
  private collection: CollectionReference<ReviewSessionDocument>
  
  constructor() {
    if (!adminFirestore) {
      throw new Error('Firebase Admin Firestore not initialized')
    }
    this.db = adminFirestore
    this.collection = this.db.collection('review_sessions') as CollectionReference<ReviewSessionDocument>
  }
  
  /**
   * Create a new review session
   */
  async create(session: Omit<ReviewSessionDocument, 'id'>): Promise<string> {
    try {
      const docRef = await this.collection.add({
        ...session,
        startedAt: Timestamp.now()
      } as ReviewSessionDocument)
      
      // Update the document with its ID
      await docRef.update({ id: docRef.id })
      
      return docRef.id
    } catch (error) {
      console.error('Error creating review session:', error)
      throw new Error('Failed to create review session')
    }
  }
  
  /**
   * Start a new review session
   */
  async startSession(
    userId: string,
    sessionType: SessionType,
    deviceType: DeviceType,
    totalItems: number,
    setId?: string
  ): Promise<string> {
    try {
      const session: Omit<ReviewSessionDocument, 'id'> = {
        userId,
        startedAt: Timestamp.now(),
        completedAt: null,
        duration: 0,
        pausedDuration: 0,
        itemsReviewed: [],
        totalItems,
        correctItems: 0,
        incorrectItems: 0,
        accuracy: 0,
        avgResponseTime: 0,
        sessionType,
        setId,
        deviceType,
        isCompleted: false
      }
      
      return await this.create(session)
    } catch (error) {
      console.error('Error starting session:', error)
      throw new Error('Failed to start session')
    }
  }
  
  /**
   * Update session with review result
   */
  async addReviewResult(sessionId: string, result: ReviewItemResult): Promise<void> {
    try {
      const sessionRef = this.collection.doc(sessionId)
      const session = await sessionRef.get()
      
      if (!session.exists) {
        throw new Error('Session not found')
      }
      
      const data = session.data() as ReviewSessionDocument
      const itemsReviewed = [...data.itemsReviewed, result]
      
      // Calculate updated statistics
      const correctItems = itemsReviewed.filter(i => i.correct).length
      const incorrectItems = itemsReviewed.length - correctItems
      const accuracy = itemsReviewed.length > 0 ? correctItems / itemsReviewed.length : 0
      const avgResponseTime = itemsReviewed.reduce((sum, i) => sum + i.responseTime, 0) / itemsReviewed.length
      
      await sessionRef.update({
        itemsReviewed,
        correctItems,
        incorrectItems,
        accuracy,
        avgResponseTime: Math.round(avgResponseTime)
      })
    } catch (error) {
      console.error('Error adding review result:', error)
      throw new Error('Failed to add review result')
    }
  }
  
  /**
   * Complete a review session
   */
  async completeSession(
    sessionId: string,
    feedback?: { rating?: number; feedback?: string }
  ): Promise<ReviewSessionDocument> {
    try {
      const sessionRef = this.collection.doc(sessionId)
      const session = await sessionRef.get()
      
      if (!session.exists) {
        throw new Error('Session not found')
      }
      
      const data = session.data() as ReviewSessionDocument
      const now = Timestamp.now()
      const duration = Math.floor((now.toMillis() - data.startedAt.toMillis()) / 1000)
      
      const updates: Partial<ReviewSessionDocument> = {
        completedAt: now,
        duration,
        isCompleted: true,
        ...(feedback?.rating && { rating: feedback.rating }),
        ...(feedback?.feedback && { feedback: feedback.feedback })
      }
      
      // Check if user broke their streak
      if (data.sessionType === 'daily') {
        const userStats = await this.getUserDailyStats(data.userId)
        if (userStats.daysWithoutReview > 1) {
          updates.streakBroken = true
        }
      }
      
      await sessionRef.update(updates)
      
      return { ...data, ...updates } as ReviewSessionDocument
    } catch (error) {
      console.error('Error completing session:', error)
      throw new Error('Failed to complete session')
    }
  }
  
  /**
   * Pause a review session
   */
  async pauseSession(sessionId: string): Promise<void> {
    try {
      const sessionRef = this.collection.doc(sessionId)
      const session = await sessionRef.get()
      
      if (!session.exists) {
        throw new Error('Session not found')
      }
      
      await sessionRef.update({
        pausedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error pausing session:', error)
      throw new Error('Failed to pause session')
    }
  }
  
  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    try {
      const sessionRef = this.collection.doc(sessionId)
      const session = await sessionRef.get()
      
      if (!session.exists) {
        throw new Error('Session not found')
      }
      
      const data = session.data() as any
      if (data.pausedAt) {
        const pausedDuration = Math.floor(
          (Timestamp.now().toMillis() - data.pausedAt.toMillis()) / 1000
        )
        
        await sessionRef.update({
          pausedAt: null,
          pausedDuration: (data.pausedDuration || 0) + pausedDuration
        })
      }
    } catch (error) {
      console.error('Error resuming session:', error)
      throw new Error('Failed to resume session')
    }
  }
  
  /**
   * Get a session by ID
   */
  async get(id: string): Promise<ReviewSessionDocument | null> {
    try {
      const doc = await this.collection.doc(id).get()
      
      if (!doc.exists) {
        return null
      }
      
      return doc.data() as ReviewSessionDocument
    } catch (error) {
      console.error('Error getting session:', error)
      throw new Error('Failed to get session')
    }
  }
  
  /**
   * Get all sessions for a user
   */
  async getByUser(
    userId: string, 
    limit: number = 50,
    startAfter?: Timestamp
  ): Promise<ReviewSessionDocument[]> {
    try {
      let query: Query = this.collection
        .where('userId', '==', userId)
        .orderBy('startedAt', 'desc')
        .limit(limit)
      
      if (startAfter) {
        query = query.startAfter(startAfter)
      }
      
      const snapshot = await query.get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSessionDocument)
    } catch (error) {
      console.error('Error getting user sessions:', error)
      throw new Error('Failed to get user sessions')
    }
  }
  
  /**
   * Get sessions by date range
   */
  async getByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ReviewSessionDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('startedAt', '>=', Timestamp.fromDate(startDate))
        .where('startedAt', '<=', Timestamp.fromDate(endDate))
        .orderBy('startedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSessionDocument)
    } catch (error) {
      console.error('Error getting sessions by date range:', error)
      throw new Error('Failed to get sessions by date range')
    }
  }
  
  /**
   * Get incomplete sessions for a user
   */
  async getIncompleteSessions(userId: string): Promise<ReviewSessionDocument[]> {
    try {
      const snapshot = await this.collection
        .where('userId', '==', userId)
        .where('isCompleted', '==', false)
        .orderBy('startedAt', 'desc')
        .get()
      
      return snapshot.docs.map(doc => doc.data() as ReviewSessionDocument)
    } catch (error) {
      console.error('Error getting incomplete sessions:', error)
      throw new Error('Failed to get incomplete sessions')
    }
  }
  
  /**
   * Get session statistics for a user
   */
  async getUserStatistics(userId: string): Promise<{
    totalSessions: number
    completedSessions: number
    totalTimeSpent: number
    averageAccuracy: number
    averageSessionTime: number
    totalItemsReviewed: number
  }> {
    try {
      const sessions = await this.getByUser(userId, 1000)
      const completedSessions = sessions.filter(s => s.isCompleted)
      
      const totalTimeSpent = completedSessions.reduce((sum, s) => sum + s.duration, 0)
      const totalAccuracy = completedSessions.reduce((sum, s) => sum + s.accuracy, 0)
      const totalItemsReviewed = completedSessions.reduce((sum, s) => sum + s.itemsReviewed.length, 0)
      
      return {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        totalTimeSpent,
        averageAccuracy: completedSessions.length > 0 ? totalAccuracy / completedSessions.length : 0,
        averageSessionTime: completedSessions.length > 0 ? totalTimeSpent / completedSessions.length : 0,
        totalItemsReviewed
      }
    } catch (error) {
      console.error('Error getting user statistics:', error)
      throw new Error('Failed to get user statistics')
    }
  }
  
  /**
   * Get daily statistics for streak calculation
   */
  async getUserDailyStats(userId: string): Promise<{
    lastReviewDate: Date | null
    daysWithoutReview: number
    currentStreak: number
  }> {
    try {
      const sessions = await this.collection
        .where('userId', '==', userId)
        .where('isCompleted', '==', true)
        .orderBy('completedAt', 'desc')
        .limit(100)
        .get()
      
      if (sessions.empty) {
        return {
          lastReviewDate: null,
          daysWithoutReview: 0,
          currentStreak: 0
        }
      }
      
      const sessionDocs = sessions.docs.map(doc => doc.data() as ReviewSessionDocument)
      const lastSession = sessionDocs[0]
      const lastReviewDate = lastSession.completedAt?.toDate() || null
      
      if (!lastReviewDate) {
        return {
          lastReviewDate: null,
          daysWithoutReview: 0,
          currentStreak: 0
        }
      }
      
      const now = new Date()
      const daysSinceLastReview = Math.floor(
        (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // Calculate streak
      let currentStreak = 0
      let currentDate = new Date(lastReviewDate)
      currentDate.setHours(0, 0, 0, 0)
      
      for (const session of sessionDocs) {
        const sessionDate = session.completedAt?.toDate()
        if (!sessionDate) continue
        
        const sessionDay = new Date(sessionDate)
        sessionDay.setHours(0, 0, 0, 0)
        
        const dayDiff = Math.floor(
          (currentDate.getTime() - sessionDay.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        if (dayDiff <= 1) {
          currentStreak++
          currentDate = sessionDay
        } else {
          break
        }
      }
      
      return {
        lastReviewDate,
        daysWithoutReview: daysSinceLastReview,
        currentStreak: daysSinceLastReview > 1 ? 0 : currentStreak
      }
    } catch (error) {
      console.error('Error getting user daily stats:', error)
      throw new Error('Failed to get user daily stats')
    }
  }
  
  /**
   * Get heatmap data for a user
   */
  async getHeatmapData(
    userId: string,
    days: number = 365
  ): Promise<Array<{ date: string; count: number; level: number }>> {
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      
      const sessions = await this.getByDateRange(userId, startDate, endDate)
      
      // Group sessions by date
      const sessionsByDate = new Map<string, number>()
      
      for (const session of sessions) {
        if (session.completedAt) {
          const date = session.completedAt.toDate().toISOString().split('T')[0]
          sessionsByDate.set(date, (sessionsByDate.get(date) || 0) + session.itemsReviewed.length)
        }
      }
      
      // Calculate max for level determination
      const max = Math.max(...Array.from(sessionsByDate.values()), 1)
      
      // Generate heatmap data
      const heatmapData: Array<{ date: string; count: number; level: number }> = []
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const count = sessionsByDate.get(dateStr) || 0
        const level = count === 0 ? 0 : Math.ceil((count / max) * 4)
        
        heatmapData.push({
          date: dateStr,
          count,
          level
        })
      }
      
      return heatmapData
    } catch (error) {
      console.error('Error getting heatmap data:', error)
      throw new Error('Failed to get heatmap data')
    }
  }
}