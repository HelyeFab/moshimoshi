import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { SRSAlgorithm, ReviewResult } from '@/lib/review-engine/srs/algorithm'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user from session
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'
    const isPremium = plan.startsWith('premium')

    if (!isPremium) {
      return NextResponse.json({
        success: false,
        message: 'Migration only available for premium users'
      })
    }

    console.log(`[SRS Migration] Starting migration for user ${session.uid}`)

    const srsAlgorithm = new SRSAlgorithm()
    let migratedCount = 0
    let skippedCount = 0
    const errors: string[] = []

    // Step 1: Fetch all review sessions for the user
    const reviewSessionsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('review_sessions')
      .orderBy('completedAt', 'desc')
      .get()

    console.log(`[SRS Migration] Found ${reviewSessionsSnapshot.size} review sessions`)

    // Build a map of item performance history
    const itemHistoryMap = new Map<string, {
      reviews: Array<{
        date: Date
        correct: boolean
        responseTime?: number
      }>
      lastReview?: Date
      totalReviews: number
      correctReviews: number
    }>()

    // Process review sessions to build history
    reviewSessionsSnapshot.forEach(doc => {
      const sessionData = doc.data()
      const completedAt = sessionData.completedAt?.toDate() || new Date()

      if (sessionData.characters && Array.isArray(sessionData.characters)) {
        sessionData.characters.forEach((char: any) => {
          const itemId = char.id
          if (!itemId) return

          if (!itemHistoryMap.has(itemId)) {
            itemHistoryMap.set(itemId, {
              reviews: [],
              totalReviews: 0,
              correctReviews: 0
            })
          }

          const history = itemHistoryMap.get(itemId)!
          history.reviews.push({
            date: completedAt,
            correct: char.correct || false,
            responseTime: char.responseTime
          })
          history.totalReviews++
          if (char.correct) history.correctReviews++

          // Track the most recent review
          if (!history.lastReview || completedAt > history.lastReview) {
            history.lastReview = completedAt
          }
        })
      }
    })

    // Step 2: Also check study sessions
    const studySessionsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('study_sessions')
      .orderBy('completedAt', 'desc')
      .get()

    console.log(`[SRS Migration] Found ${studySessionsSnapshot.size} study sessions`)

    studySessionsSnapshot.forEach(doc => {
      const sessionData = doc.data()
      const completedAt = sessionData.completedAt?.toDate() || new Date()

      if (sessionData.characters && Array.isArray(sessionData.characters)) {
        sessionData.characters.forEach((char: any) => {
          const itemId = char.id
          if (!itemId) return

          if (!itemHistoryMap.has(itemId)) {
            itemHistoryMap.set(itemId, {
              reviews: [],
              totalReviews: 0,
              correctReviews: 0
            })
          }

          const history = itemHistoryMap.get(itemId)!
          history.reviews.push({
            date: completedAt,
            correct: char.correct || false,
            responseTime: char.responseTime
          })
          history.totalReviews++
          if (char.correct) history.correctReviews++

          if (!history.lastReview || completedAt > history.lastReview) {
            history.lastReview = completedAt
          }
        })
      }
    })

    console.log(`[SRS Migration] Processing ${itemHistoryMap.size} unique items`)

    // Step 3: Calculate SRS data for each item
    const batch = adminDb.batch()
    const progressCollection = adminDb.collection('users').doc(session.uid).collection('progress')

    for (const [itemId, history] of itemHistoryMap) {
      try {
        if (history.reviews.length === 0) {
          skippedCount++
          continue
        }

        // Sort reviews by date
        history.reviews.sort((a, b) => a.date.getTime() - b.date.getTime())

        // Simulate the SRS progression based on review history
        let srsData = {
          interval: 0,
          easeFactor: 2.5,
          repetitions: 0,
          lastReviewedAt: null as Date | null,
          nextReviewAt: new Date(),
          status: 'new' as 'new' | 'learning' | 'review' | 'mastered',
          reviewCount: 0,
          correctCount: 0,
          streak: 0,
          bestStreak: 0
        }

        // Process each review to build up SRS state
        let currentStreak = 0
        let bestStreak = 0

        for (const review of history.reviews) {
          const reviewResult: ReviewResult = {
            correct: review.correct,
            responseTime: review.responseTime || 1000,
            confidence: review.correct ? 4 : 2, // Estimate confidence
            attemptCount: 1
          }

          // Create a mock content item for SRS calculation
          const contentWithSRS = {
            id: itemId,
            contentType: 'kanji' as any, // Type doesn't matter for SRS calculation
            primaryDisplay: itemId,
            primaryAnswer: itemId,
            difficulty: 0.5,
            supportedModes: ['recognition', 'recall'] as any,
            srsData: srsData
          }

          // Calculate next SRS state
          const newSRS = srsAlgorithm.calculateNextReview(contentWithSRS, reviewResult)

          // Update our tracking
          srsData = newSRS
          srsData.lastReviewedAt = review.date

          // Update streak
          if (review.correct) {
            currentStreak++
            bestStreak = Math.max(bestStreak, currentStreak)
          } else {
            currentStreak = 0
          }
        }

        // Final SRS data with accurate counts
        srsData.reviewCount = history.totalReviews
        srsData.correctCount = history.correctReviews
        srsData.streak = currentStreak
        srsData.bestStreak = bestStreak

        // Calculate next review date from last review
        if (history.lastReview) {
          const daysSinceLastReview = Math.floor(
            (new Date().getTime() - history.lastReview.getTime()) / (1000 * 60 * 60 * 24)
          )

          // Adjust next review date based on interval and time passed
          const nextReviewDate = new Date(history.lastReview)
          nextReviewDate.setDate(nextReviewDate.getDate() + srsData.interval)

          // If we're past the review date, mark as overdue
          if (nextReviewDate < new Date()) {
            srsData.nextReviewAt = new Date() // Due now
          } else {
            srsData.nextReviewAt = nextReviewDate
          }
        }

        // Determine content type from ID pattern
        let contentType = 'unknown'
        if (itemId.startsWith('hiragana-')) {
          contentType = 'hiragana'
        } else if (itemId.startsWith('katakana-')) {
          contentType = 'katakana'
        } else if (itemId.match(/^[一-龯]/)) {
          contentType = 'kanji'
        } else if (itemId.includes('-')) {
          contentType = 'vocabulary'
        }

        // Update or create progress document
        const progressRef = progressCollection.doc(itemId)
        batch.set(progressRef, {
          contentId: itemId,
          contentType,
          srsData,
          lastReviewedAt: history.lastReview,
          totalReviews: history.totalReviews,
          correctReviews: history.correctReviews,
          updatedAt: FieldValue.serverTimestamp(),
          migratedAt: FieldValue.serverTimestamp()
        }, { merge: true })

        migratedCount++

        // Log progress every 10 items
        if (migratedCount % 10 === 0) {
          console.log(`[SRS Migration] Processed ${migratedCount} items...`)
        }
      } catch (error) {
        console.error(`[SRS Migration] Error processing item ${itemId}:`, error)
        errors.push(`Failed to process item ${itemId}`)
        skippedCount++
      }
    }

    // Commit the batch
    await batch.commit()

    console.log(`[SRS Migration] Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`)

    return NextResponse.json({
      success: true,
      message: `Migration complete! Processed ${migratedCount} items.`,
      stats: {
        migrated: migratedCount,
        skipped: skippedCount,
        totalProcessed: itemHistoryMap.size,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Return first 10 errors if any
    })

  } catch (error) {
    console.error('[SRS Migration] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}