/**
 * AnkiStudyManager - Manages SRS-based study sessions for Anki decks
 *
 * This class handles:
 * - SRS calculations using the existing SRSAlgorithm
 * - Daily progress tracking per deck in IndexedDB
 * - Card filtering based on new/review status and daily limits
 * - Card SRS data initialization and updates
 */

import { openDB, IDBPDatabase } from 'idb'
import { SRSAlgorithm, ReviewResult } from '@/lib/review-engine/srs/algorithm'
import { ReviewableContentWithSRS } from '@/lib/review-engine/core/interfaces'
import { AnkiCard } from './importer'
import { StoredAnkiDeck, ankiDeckManager } from './AnkiDeckManager'
import { nowDate } from '@/lib/time/dateProvider'

/**
 * SRS data specific to Anki cards
 * Extends the core SRSData interface with Anki-specific fields
 */
export interface CardSRSData {
  status: 'new' | 'learning' | 'review' | 'mastered'
  interval: number
  easeFactor: number
  repetitions: number
  nextReviewAt: Date | null
  reviewCount: number
  correctCount: number
  streak: number
  bestStreak: number
  lastReviewedAt: Date | null
}

/**
 * Daily progress tracking for a deck
 */
export interface AnkiDailyProgress {
  id: string // `${deckId}_${dateString}`
  deckId: string
  userId: string
  date: string // YYYY-MM-DD
  newCardsStudied: number
  reviewCardsStudied: number
  totalTime: number
  cardIds: string[] // Cards studied today
  updatedAt: number
}

/**
 * Result of getting due cards for study
 */
export interface DueCardsResult {
  newCards: AnkiCard[]
  reviewCards: AnkiCard[]
  remainingNew: number
  remainingReviews: number
}

/**
 * Extended AnkiCard with SRS data
 */
export interface AnkiCardWithSRS extends AnkiCard {
  srsData?: CardSRSData
}

/**
 * IndexedDB schema for daily progress storage
 */
interface AnkiProgressDB {
  dailyProgress: AnkiDailyProgress
}

/**
 * AnkiStudyManager - Singleton class for managing Anki study sessions
 */
export class AnkiStudyManager {
  private static instance: AnkiStudyManager
  private srsAlgorithm: SRSAlgorithm
  private db: IDBPDatabase<AnkiProgressDB> | null = null

  private constructor() {
    // Initialize the SRS algorithm with default config
    this.srsAlgorithm = new SRSAlgorithm()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AnkiStudyManager {
    if (!this.instance) {
      this.instance = new AnkiStudyManager()
    }
    return this.instance
  }

  /**
   * Initialize IndexedDB for daily progress storage
   */
  private async initDB(): Promise<IDBPDatabase<AnkiProgressDB>> {
    if (this.db) return this.db

    try {
      this.db = await openDB<AnkiProgressDB>('AnkiProgressDB', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('dailyProgress')) {
            const store = db.createObjectStore('dailyProgress', { keyPath: 'id' })
            store.createIndex('deckId', 'deckId')
            store.createIndex('userId', 'userId')
            store.createIndex('date', 'date')
            // Compound index for efficient queries
            store.createIndex('userId_date', ['userId', 'date'])
          }
        },
      })
      return this.db
    } catch (error) {
      console.error('[AnkiStudyManager] Failed to initialize IndexedDB:', error)
      throw new Error('Failed to initialize local storage for Anki progress')
    }
  }

  /**
   * Get today's date string in YYYY-MM-DD format
   */
  private getTodayDateString(): string {
    const now = nowDate()
    return now.toISOString().split('T')[0]
  }

  /**
   * Generate progress ID from deckId and date
   */
  private getProgressId(deckId: string, dateString: string): string {
    return `${deckId}_${dateString}`
  }

  /**
   * Initialize SRS data for a card if not present
   * Returns the card with initialized SRS data
   */
  initializeCardSRS(card: AnkiCard): AnkiCardWithSRS {
    // If card already has SRS data, return as-is
    if ((card as AnkiCardWithSRS).srsData) {
      return card as AnkiCardWithSRS
    }

    // Initialize default SRS data for new card
    const srsData: CardSRSData = {
      status: 'new',
      interval: 0,
      easeFactor: 2.5, // Default ease factor from SM-2
      repetitions: 0,
      nextReviewAt: null, // New cards are always available
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0,
      lastReviewedAt: null,
    }

    return {
      ...card,
      srsData,
    }
  }

  /**
   * Get today's progress for a deck
   * Creates a new progress record if none exists
   */
  async getTodayProgress(deckId: string, userId: string): Promise<AnkiDailyProgress> {
    const db = await this.initDB()
    const dateString = this.getTodayDateString()
    const progressId = this.getProgressId(deckId, dateString)

    // Try to get existing progress
    const existing = await db.get('dailyProgress', progressId)
    if (existing) {
      return existing
    }

    // Create new progress record for today
    const newProgress: AnkiDailyProgress = {
      id: progressId,
      deckId,
      userId,
      date: dateString,
      newCardsStudied: 0,
      reviewCardsStudied: 0,
      totalTime: 0,
      cardIds: [],
      updatedAt: Date.now(),
    }

    // Save to IndexedDB
    await db.put('dailyProgress', newProgress)
    return newProgress
  }

  /**
   * Get cards due for study, respecting daily limits
   *
   * Daily limits logic:
   * - Cards with status 'new' count against newCardsPerDay
   * - Cards with status 'learning' | 'review' | 'mastered' that are due count against reviewsPerDay
   * - A card is due if nextReviewAt <= now OR nextReviewAt is null (never reviewed)
   */
  async getDueCards(deck: StoredAnkiDeck, userId: string): Promise<DueCardsResult> {
    const progress = await this.getTodayProgress(deck.id, userId)
    const settings = deck.settings || { newCardsPerDay: 20, reviewsPerDay: 100, autoPlayAudio: true }

    const now = nowDate()
    const newCards: AnkiCardWithSRS[] = []
    const reviewCards: AnkiCardWithSRS[] = []

    // Initialize SRS data for all cards and categorize them
    for (const card of deck.cards) {
      const cardWithSRS = this.initializeCardSRS(card)
      const srsData = cardWithSRS.srsData!

      // Skip cards already studied today
      if (progress.cardIds.includes(card.id)) {
        continue
      }

      if (srsData.status === 'new') {
        // New cards
        newCards.push(cardWithSRS)
      } else {
        // Learning, review, or mastered cards - check if due
        const isDue = srsData.nextReviewAt === null || new Date(srsData.nextReviewAt) <= now
        if (isDue) {
          reviewCards.push(cardWithSRS)
        }
      }
    }

    // Calculate remaining limits
    const remainingNew = Math.max(0, settings.newCardsPerDay - progress.newCardsStudied)
    const remainingReviews = Math.max(0, settings.reviewsPerDay - progress.reviewCardsStudied)

    // Sort and limit new cards
    // New cards are presented in order (could be deck order or randomized)
    const limitedNewCards = newCards.slice(0, remainingNew)

    // Sort review cards by priority (most overdue first)
    const sortedReviewCards = this.sortReviewCardsByPriority(reviewCards)
    const limitedReviewCards = sortedReviewCards.slice(0, remainingReviews)

    return {
      newCards: limitedNewCards,
      reviewCards: limitedReviewCards,
      remainingNew: remainingNew - limitedNewCards.length,
      remainingReviews: remainingReviews - limitedReviewCards.length,
    }
  }

  /**
   * Sort review cards by priority (most overdue first)
   */
  private sortReviewCardsByPriority(cards: AnkiCardWithSRS[]): AnkiCardWithSRS[] {
    const now = nowDate().getTime()

    return cards.sort((a, b) => {
      const aNextReview = a.srsData?.nextReviewAt
        ? new Date(a.srsData.nextReviewAt).getTime()
        : 0
      const bNextReview = b.srsData?.nextReviewAt
        ? new Date(b.srsData.nextReviewAt).getTime()
        : 0

      // Calculate how overdue each card is (higher = more overdue)
      const aOverdue = now - aNextReview
      const bOverdue = now - bNextReview

      // Most overdue cards come first
      return bOverdue - aOverdue
    })
  }

  /**
   * Record that a card was studied (update daily progress)
   */
  async recordCardStudied(
    deckId: string,
    cardId: string,
    userId: string,
    isNew: boolean
  ): Promise<void> {
    const db = await this.initDB()
    const progress = await this.getTodayProgress(deckId, userId)

    // Skip if card already recorded today
    if (progress.cardIds.includes(cardId)) {
      return
    }

    // Update progress
    const updatedProgress: AnkiDailyProgress = {
      ...progress,
      newCardsStudied: isNew ? progress.newCardsStudied + 1 : progress.newCardsStudied,
      reviewCardsStudied: isNew ? progress.reviewCardsStudied : progress.reviewCardsStudied + 1,
      cardIds: [...progress.cardIds, cardId],
      updatedAt: Date.now(),
    }

    await db.put('dailyProgress', updatedProgress)
  }

  /**
   * Process review result - update card SRS using SRSAlgorithm
   *
   * This method converts the Anki card format to the ReviewableContentWithSRS format
   * expected by the SRSAlgorithm, processes the review, and returns the updated card
   */
  processReviewResult(
    card: AnkiCard,
    result: { correct: boolean; responseTime: number; confidence?: 1 | 2 | 3 | 4 | 5 }
  ): AnkiCardWithSRS {
    // Ensure card has SRS data
    const cardWithSRS = this.initializeCardSRS(card)
    const currentSRS = cardWithSRS.srsData!

    // Convert to ReviewableContentWithSRS format for the algorithm
    const reviewableContent: ReviewableContentWithSRS = {
      ...card,
      srsData: {
        interval: currentSRS.interval,
        easeFactor: currentSRS.easeFactor,
        repetitions: currentSRS.repetitions,
        lastReviewedAt: currentSRS.lastReviewedAt,
        nextReviewAt: currentSRS.nextReviewAt || nowDate(),
        status: currentSRS.status,
        reviewCount: currentSRS.reviewCount,
        correctCount: currentSRS.correctCount,
        streak: currentSRS.streak,
        bestStreak: currentSRS.bestStreak,
      },
    }

    // Create ReviewResult for the algorithm
    const reviewResult: ReviewResult = {
      correct: result.correct,
      responseTime: result.responseTime,
      confidence: result.confidence,
    }

    // Use the existing SRSAlgorithm to calculate new SRS data
    const newSRSData = this.srsAlgorithm.calculateNextReview(reviewableContent, reviewResult)

    // Convert back to CardSRSData format
    const updatedSRS: CardSRSData = {
      status: newSRSData.status,
      interval: newSRSData.interval,
      easeFactor: newSRSData.easeFactor,
      repetitions: newSRSData.repetitions,
      nextReviewAt: newSRSData.nextReviewAt,
      reviewCount: newSRSData.reviewCount,
      correctCount: newSRSData.correctCount,
      streak: newSRSData.streak,
      bestStreak: newSRSData.bestStreak,
      lastReviewedAt: newSRSData.lastReviewedAt,
    }

    return {
      ...cardWithSRS,
      srsData: updatedSRS,
    }
  }

  /**
   * Save updated card SRS back to deck
   *
   * This updates the card in the deck stored in AnkiDeckManager
   */
  async updateCardInDeck(
    deckId: string,
    card: AnkiCardWithSRS,
    userId: string,
    isPremium: boolean
  ): Promise<void> {
    // Get the current deck
    const deck = await ankiDeckManager.getDeck(deckId, userId)
    if (!deck) {
      console.error('[AnkiStudyManager] Deck not found:', deckId)
      return
    }

    // Find and update the card
    const cardIndex = deck.cards.findIndex(c => c.id === card.id)
    if (cardIndex === -1) {
      console.error('[AnkiStudyManager] Card not found in deck:', card.id)
      return
    }

    // Update the card in the deck
    deck.cards[cardIndex] = card as AnkiCard

    // Save the updated deck using AnkiDeckManager
    // We use a partial update approach - just updating the cards array
    await this.saveUpdatedDeck(deck, userId, isPremium)
  }

  /**
   * Save updated deck to storage
   * This is a helper method that handles the deck update logic
   */
  private async saveUpdatedDeck(
    deck: StoredAnkiDeck,
    userId: string,
    isPremium: boolean
  ): Promise<void> {
    // Access IndexedDB directly for updating
    const db = await openDB('AnkiDecksDB', 1)

    const updatedDeck: StoredAnkiDeck = {
      ...deck,
      updatedAt: Date.now(),
    }

    // Convert Map to object for storage if needed
    const deckForStorage = {
      ...updatedDeck,
      mediaUrls: updatedDeck.mediaUrls instanceof Map
        ? Object.fromEntries(updatedDeck.mediaUrls)
        : updatedDeck.mediaUrls,
    }

    // Save to IndexedDB
    // Using 'as unknown' due to IDB type complexity with converted Map types
    await db.put('decks', deckForStorage as unknown as StoredAnkiDeck)

    // For premium users, also sync to Firebase
    if (isPremium && userId !== 'guest') {
      try {
        const response = await fetch(`/api/anki/decks/${deck.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cards: deck.cards }),
        })

        if (!response.ok) {
          console.error('[AnkiStudyManager] Failed to sync deck to server')
        }
      } catch (error) {
        console.error('[AnkiStudyManager] Error syncing deck to server:', error)
        // Continue anyway - local update succeeded
      }
    }
  }

  /**
   * Add study time to today's progress
   */
  async addStudyTime(deckId: string, userId: string, timeMs: number): Promise<void> {
    const db = await this.initDB()
    const progress = await this.getTodayProgress(deckId, userId)

    const updatedProgress: AnkiDailyProgress = {
      ...progress,
      totalTime: progress.totalTime + timeMs,
      updatedAt: Date.now(),
    }

    await db.put('dailyProgress', updatedProgress)
  }

  /**
   * Get progress for a date range
   */
  async getProgressRange(
    deckId: string,
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<AnkiDailyProgress[]> {
    const db = await this.initDB()
    const allProgress = await db.getAllFromIndex('dailyProgress', 'deckId', deckId)

    return allProgress.filter(
      p => p.userId === userId && p.date >= startDate && p.date <= endDate
    ).sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get statistics summary for a deck
   */
  async getDeckStatistics(deck: StoredAnkiDeck): Promise<{
    totalCards: number
    newCards: number
    learningCards: number
    reviewCards: number
    masteredCards: number
    averageEase: number
    totalReviews: number
    retention: number
  }> {
    let newCount = 0
    let learningCount = 0
    let reviewCount = 0
    let masteredCount = 0
    let totalEase = 0
    let totalReviews = 0
    let totalCorrect = 0

    for (const card of deck.cards) {
      const cardWithSRS = this.initializeCardSRS(card)
      const srs = cardWithSRS.srsData!

      switch (srs.status) {
        case 'new':
          newCount++
          break
        case 'learning':
          learningCount++
          break
        case 'review':
          reviewCount++
          break
        case 'mastered':
          masteredCount++
          break
      }

      if (srs.reviewCount > 0) {
        totalEase += srs.easeFactor
        totalReviews += srs.reviewCount
        totalCorrect += srs.correctCount
      }
    }

    const cardsWithReviews = learningCount + reviewCount + masteredCount
    const averageEase = cardsWithReviews > 0 ? totalEase / cardsWithReviews : 2.5
    const retention = totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0

    return {
      totalCards: deck.cards.length,
      newCards: newCount,
      learningCards: learningCount,
      reviewCards: reviewCount,
      masteredCards: masteredCount,
      averageEase: Number(averageEase.toFixed(2)),
      totalReviews,
      retention: Number(retention.toFixed(1)),
    }
  }

  /**
   * Clear all progress data (for logout or reset)
   */
  async clearProgressData(userId: string): Promise<void> {
    const db = await this.initDB()
    const allProgress = await db.getAllFromIndex('dailyProgress', 'userId', userId)

    const tx = db.transaction('dailyProgress', 'readwrite')
    for (const progress of allProgress) {
      await tx.store.delete(progress.id)
    }
    await tx.done
  }
}

// Export singleton instance
export const ankiStudyManager = AnkiStudyManager.getInstance()
