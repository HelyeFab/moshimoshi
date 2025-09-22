import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { reviewLogger } from '@/lib/monitoring/logger'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { UniversalProgressManager } from '@/lib/review-engine/progress/UniversalProgressManager'
import { SRSIntegration } from '@/lib/review-engine/srs/integration'
import { ReviewableContentWithSRS } from '@/lib/review-engine/srs/types'

// Create a concrete implementation of UniversalProgressManager
class ConcreteProgressManager extends UniversalProgressManager {
  createInitialProgress(contentId: string, contentType: string) {
    return {
      contentId,
      contentType,
      status: 'new' as const,
      firstSeenAt: new Date(),
      lastReviewedAt: null,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 0,
      streakCount: 0,
      lastResult: null,
      srsData: null,
      metadata: {}
    }
  }
}

const progressManager = new ConcreteProgressManager()
const srsIntegration = new SRSIntegration()

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session - but allow guest access with mock data
    const session = await getSession()
    const userId = session?.userId || 'guest'

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const contentType = searchParams.get('type') || 'all'
    const maxItems = parseInt(searchParams.get('limit') || '500')

    // Fetch progress data from IndexedDB via API or Firebase
    const progressData = await fetchUserProgress(userId, contentType, maxItems)

    return NextResponse.json({
      items: progressData,
      total: progressData.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    reviewLogger.error('Failed to fetch studied items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress data' },
      { status: 500 }
    )
  }
}

async function fetchUserProgress(
  userId: string,
  contentType: string,
  maxItems: number
) {
  try {
    // For guest users, still return mock data
    if (userId === 'guest') {
      return getMockData()
    }

    // Try to fetch from Firebase for authenticated users
    const items: any[] = []

    // Fetch from multiple content types
    const contentTypes = contentType === 'all'
      ? ['kana', 'kanji', 'vocabulary', 'sentence']
      : [contentType]

    for (const type of contentTypes) {
      try {
        // Get progress data from Firebase
        const progressRef = collection(db, 'progress')
        const q = query(
          progressRef,
          where('userId', '==', userId),
          where('contentType', '==', type),
          orderBy('lastReviewedAt', 'desc'),
          limit(Math.floor(maxItems / contentTypes.length))
        )

        const snapshot = await getDocs(q)

        snapshot.forEach(doc => {
          const data = doc.data()
          const srsData = data.srsData || null

          // Convert Firebase data to ReviewItem format
          items.push({
            id: doc.id,
            contentType: type as 'kana' | 'kanji' | 'vocabulary' | 'sentence',
            primaryDisplay: data.contentDisplay || data.contentId,
            secondaryDisplay: data.meaning || data.reading,
            status: determineStatus(data),
            lastReviewedAt: data.lastReviewedAt?.toDate() || null,
            nextReviewAt: srsData?.nextReviewAt || calculateNextReview(data),
            srsLevel: srsData?.repetitions || 0,
            accuracy: data.accuracy || 0,
            reviewCount: data.reviewCount || 0,
            correctCount: data.correctCount || 0,
            tags: data.tags || [],
            source: data.source || getSourceByType(type)
          })
        })
      } catch (error) {
        reviewLogger.warn(`Failed to fetch ${type} progress from Firebase:`, error)
      }
    }

    // If no Firebase data, try IndexedDB through progress manager
    if (items.length === 0) {
      try {
        await progressManager.initDB()

        for (const type of contentTypes) {
          const progressMap = await progressManager.getProgress(userId, type, false)

          progressMap.forEach((progress, contentId) => {
            const srsData = progress.srsData

            items.push({
              id: `${type}_${contentId}`,
              contentType: type as 'kana' | 'kanji' | 'vocabulary' | 'sentence',
              primaryDisplay: contentId,
              secondaryDisplay: progress.metadata?.meaning || progress.metadata?.reading,
              status: progress.status || 'new',
              lastReviewedAt: progress.lastReviewedAt,
              nextReviewAt: srsData?.nextReviewAt || calculateNextReview(progress),
              srsLevel: srsData?.repetitions || 0,
              accuracy: progress.accuracy || 0,
              reviewCount: progress.reviewCount || 0,
              correctCount: progress.correctCount || 0,
              tags: progress.metadata?.tags || [],
              source: progress.metadata?.source || getSourceByType(type)
            })
          })
        }
      } catch (error) {
        reviewLogger.warn('Failed to fetch from IndexedDB:', error)
      }
    }

    // If still no data, return mock data as fallback
    if (items.length === 0) {
      return getMockData()
    }

    // Sort by last reviewed date and limit
    return items
      .sort((a, b) => {
        const dateA = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0
        const dateB = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, maxItems)

  } catch (error) {
    reviewLogger.error('Error in fetchUserProgress:', error)
    return getMockData()
  }
}

function determineStatus(data: any): 'new' | 'learning' | 'review' | 'mastered' {
  if (!data.lastReviewedAt) return 'new'

  const accuracy = data.accuracy || 0
  const reviewCount = data.reviewCount || 0
  const srsData = data.srsData

  // Mastered: 21+ days retention with 90%+ accuracy
  if (srsData?.interval >= 21 && accuracy >= 0.9) {
    return 'mastered'
  }

  // Learning: Still in initial learning steps (< 1 day)
  if (srsData?.interval < 1 || reviewCount < 3) {
    return 'learning'
  }

  // Review: In regular review cycle
  return 'review'
}

function calculateNextReview(data: any): Date {
  const srsData = data.srsData

  if (!srsData || !data.lastReviewedAt) {
    return new Date() // Due now if never reviewed
  }

  const lastReview = data.lastReviewedAt instanceof Date
    ? data.lastReviewedAt
    : data.lastReviewedAt?.toDate?.() || new Date()

  const interval = srsData.interval || 1
  const nextReview = new Date(lastReview)
  nextReview.setDate(nextReview.getDate() + interval)

  return nextReview
}

function getSourceByType(type: string): string {
  switch (type) {
    case 'kana':
      return 'Hiragana & Katakana'
    case 'kanji':
      return 'JLPT N5-N1'
    case 'vocabulary':
      return 'Core Vocabulary'
    case 'sentence':
      return 'Example Sentences'
    default:
      return 'General'
  }
}

function getMockData() {
  // Return the original mock data as fallback
  return [
    // Kana items
    {
      id: '1',
      contentType: 'kana' as const,
      primaryDisplay: 'あ',
      secondaryDisplay: 'a',
      status: 'mastered' as const,
      lastReviewedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      srsLevel: 5,
      accuracy: 0.95,
      reviewCount: 15,
      correctCount: 14,
      tags: ['hiragana', 'basic'],
      source: 'Hiragana Basics'
    },
    {
      id: '2',
      contentType: 'kana' as const,
      primaryDisplay: 'い',
      secondaryDisplay: 'i',
      status: 'review' as const,
      lastReviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      srsLevel: 3,
      accuracy: 0.85,
      reviewCount: 8,
      correctCount: 7,
      tags: ['hiragana', 'basic'],
      source: 'Hiragana Basics'
    },
    // Kanji items
    {
      id: '3',
      contentType: 'kanji' as const,
      primaryDisplay: '水',
      secondaryDisplay: 'water, みず',
      status: 'learning' as const,
      lastReviewedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Overdue
      srsLevel: 1,
      accuracy: 0.6,
      reviewCount: 3,
      correctCount: 2,
      tags: ['N5', 'nature'],
      source: 'JLPT N5'
    },
    {
      id: '4',
      contentType: 'kanji' as const,
      primaryDisplay: '火',
      secondaryDisplay: 'fire, ひ',
      status: 'new' as const,
      lastReviewedAt: null,
      nextReviewAt: new Date(), // Due now
      srsLevel: 0,
      accuracy: 0,
      reviewCount: 0,
      correctCount: 0,
      tags: ['N5', 'nature'],
      source: 'JLPT N5'
    },
    // Vocabulary items
    {
      id: '5',
      contentType: 'vocabulary' as const,
      primaryDisplay: '食べる',
      secondaryDisplay: 'to eat, たべる',
      status: 'review' as const,
      lastReviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      srsLevel: 2,
      accuracy: 0.75,
      reviewCount: 5,
      correctCount: 4,
      tags: ['verb', 'common'],
      source: 'Core 2000'
    },
    // More items...
    {
      id: '6',
      contentType: 'kana' as const,
      primaryDisplay: 'う',
      secondaryDisplay: 'u',
      status: 'learning' as const,
      lastReviewedAt: new Date(Date.now() - 30 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 30 * 60 * 1000),
      srsLevel: 1,
      accuracy: 0.7,
      reviewCount: 2,
      correctCount: 1,
      tags: ['hiragana', 'basic'],
      source: 'Hiragana Basics'
    },
    {
      id: '7',
      contentType: 'kana' as const,
      primaryDisplay: 'え',
      secondaryDisplay: 'e',
      status: 'review' as const,
      lastReviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Overdue
      srsLevel: 2,
      accuracy: 0.8,
      reviewCount: 4,
      correctCount: 3,
      tags: ['hiragana', 'basic'],
      source: 'Hiragana Basics'
    },
    {
      id: '8',
      contentType: 'kana' as const,
      primaryDisplay: 'お',
      secondaryDisplay: 'o',
      status: 'mastered' as const,
      lastReviewedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      srsLevel: 6,
      accuracy: 0.92,
      reviewCount: 20,
      correctCount: 18,
      tags: ['hiragana', 'basic'],
      source: 'Hiragana Basics'
    },
    {
      id: '9',
      contentType: 'sentence' as const,
      primaryDisplay: 'おはようございます',
      secondaryDisplay: 'Good morning (polite)',
      status: 'learning' as const,
      lastReviewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 10 * 60 * 1000),
      srsLevel: 1,
      accuracy: 0.65,
      reviewCount: 2,
      correctCount: 1,
      tags: ['greeting', 'polite'],
      source: 'Common Phrases'
    },
    {
      id: '10',
      contentType: 'vocabulary' as const,
      primaryDisplay: '飲む',
      secondaryDisplay: 'to drink, のむ',
      status: 'new' as const,
      lastReviewedAt: null,
      nextReviewAt: new Date(),
      srsLevel: 0,
      accuracy: 0,
      reviewCount: 0,
      correctCount: 0,
      tags: ['verb', 'common'],
      source: 'Core 2000'
    }
  ]
}