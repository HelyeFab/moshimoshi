import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { reviewLogger } from '@/lib/monitoring/logger'
import { adminDb } from '@/lib/firebase/admin'
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
    // Get authenticated session
    const session = await getSession()
    const userId = session?.uid || 'guest'

    console.log('[API /review/progress/studied] Session info:', {
      hasSession: !!session,
      userId,
      sessionUid: session?.uid,
      sessionEmail: session?.email,
      tier: session?.tier
    })

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
    // For guest users, return empty data
    if (userId === 'guest') {
      return []
    }

    // Try to fetch from Firebase for authenticated users
    const items: any[] = []

    // Fetch from multiple content types - include legacy names
    const contentTypes = contentType === 'all'
      ? ['kana', 'hiragana', 'katakana', 'kanji', 'vocabulary', 'sentence']
      : [contentType]

    // Map legacy content types to standard ones
    const mapContentType = (type: string) => {
      if (type === 'hiragana' || type === 'katakana') return 'kana'
      return type
    }

    for (const type of contentTypes) {
      try {
        // Get progress data from Firebase - from the user's subcollection using Admin SDK
        console.log(`[API] Fetching progress for user ${userId}, type: ${type}`)
        const progressRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('progress')
        const progressSnapshot = await progressRef.get()

        console.log(`[API] Found ${progressSnapshot.size} progress documents`)

        // Find the document for this content type
        let typeDoc = null
        progressSnapshot.forEach(doc => {
          console.log(`[API] Document ID: ${doc.id}`)
          if (doc.id === type) {
            typeDoc = doc
          }
        })

        if (typeDoc) {
          const docData = typeDoc.data()
          const itemsObject = docData?.items || {}

          // Check if this is a legacy single-item document (like the user ID document)
          if (Object.keys(itemsObject).length === 0 && docData) {
            // Check if the document itself contains progress fields
            if (docData.status || docData.viewCount !== undefined) {
              // This is a single progress item stored at document level
              console.log(`[API] Found legacy single item for ${type}`)
              const mappedType = mapContentType(type)
              const srsData = docData.srsData || null

              items.push({
                id: `${mappedType}_${type}`,
                contentType: mappedType as 'kana' | 'kanji' | 'vocabulary' | 'sentence',
                primaryDisplay: docData.contentDisplay || docData.contentId || type,
                secondaryDisplay: docData.meaning || docData.reading || '',
                status: determineStatus(docData),
                lastReviewedAt: docData.lastReviewedAt ? new Date(docData.lastReviewedAt) : null,
                nextReviewAt: srsData?.nextReviewAt ? new Date(srsData.nextReviewAt) : calculateNextReview(docData),
                srsLevel: srsData?.repetitions || 0,
                accuracy: docData.accuracy || 0,
                reviewCount: docData.reviewCount || docData.viewCount || 0,
                correctCount: docData.correctCount || 0,
                tags: docData.tags || [],
                source: docData.source || getSourceByType(mappedType)
              })
            }
          } else {
            console.log(`[API] Found ${Object.keys(itemsObject).length} items for ${type}`)

            // Process each item in the progress document
            Object.entries(itemsObject).forEach(([contentId, data]: [string, any]) => {
              const mappedType = mapContentType(type)
              const srsData = data.srsData || null

              // Convert Firebase data to ReviewItem format
              items.push({
                id: `${mappedType}_${contentId}`,
                contentType: mappedType as 'kana' | 'kanji' | 'vocabulary' | 'sentence',
                primaryDisplay: data.contentDisplay || contentId,
                secondaryDisplay: data.meaning || data.reading || data.metadata?.meaning || data.metadata?.reading,
                status: determineStatus(data),
                lastReviewedAt: data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
                nextReviewAt: srsData?.nextReviewAt ? new Date(srsData.nextReviewAt) : calculateNextReview(data),
                srsLevel: srsData?.repetitions || 0,
                accuracy: data.accuracy || 0,
                reviewCount: data.reviewCount || 0,
                correctCount: data.correctCount || 0,
                tags: data.tags || data.metadata?.tags || [],
                source: data.source || data.metadata?.source || getSourceByType(mappedType)
              })
            })
          }
        }
      } catch (error) {
        reviewLogger.warn(`Failed to fetch ${type} progress from Firebase:`, error)
      }
    }

    // Always fetch from kanji_browse_history collection for kanji data
    if (contentType === 'all' || contentType === 'kanji') {
      try {
        console.log('[API] Checking kanji_browse_history...')
        const kanjiBrowseRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('kanji_browse_history')

        const kanjiBrowseSnapshot = await kanjiBrowseRef.limit(200).get()

        if (!kanjiBrowseSnapshot.empty) {
          console.log(`[API] Found ${kanjiBrowseSnapshot.size} kanji browse history entries`)

          kanjiBrowseSnapshot.forEach(doc => {
            const data = doc.data()
            const kanjiId = data.kanjiId || data.character || doc.id

            // Don't add duplicates
            const isDuplicate = items.some(item =>
              item.primaryDisplay === kanjiId && item.contentType === 'kanji'
            )
            if (!isDuplicate) {
              items.push({
                id: `kanji_${kanjiId}`,
                contentType: 'kanji' as const,
                primaryDisplay: kanjiId,
                secondaryDisplay: data.meaning || '',
                status: 'learning' as const,
                lastReviewedAt: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp),
                nextReviewAt: new Date(),
                srsLevel: 0,
                accuracy: 0,
                reviewCount: 1,
                correctCount: 0,
                tags: [],
                source: data.source || 'Kanji Browser'
              })
            }
          })
        }
      } catch (error) {
        reviewLogger.warn('Failed to fetch kanji_browse_history:', error)
      }
    }

    // Also fetch from review history for kana items
    if (contentType === 'all' || contentType === 'kana') {
      try {
        console.log('[API] No progress data found, checking review history...')
        const historyRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('review_history')

        const historySnapshot = await historyRef.limit(50).get()

        if (!historySnapshot.empty) {
          console.log(`[API] Found ${historySnapshot.size} review history entries`)

          // Group by content type and ID to get unique items
          const uniqueItems = new Map<string, any>()

          historySnapshot.forEach(doc => {
            const data = doc.data()
            const key = `${data.contentType}_${data.contentId}`

            if (!uniqueItems.has(key)) {
              const mappedType = mapContentType(data.contentType || 'kana')
              uniqueItems.set(key, {
                id: key,
                contentType: mappedType as 'kana' | 'kanji' | 'vocabulary' | 'sentence',
                primaryDisplay: data.contentId || data.content || '',
                secondaryDisplay: data.meaning || data.reading || '',
                status: 'learning' as const,
                lastReviewedAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
                nextReviewAt: new Date(), // Due now since no SRS data
                srsLevel: 0,
                accuracy: data.correct ? 1 : 0,
                reviewCount: 1,
                correctCount: data.correct ? 1 : 0,
                tags: [],
                source: getSourceByType(mappedType)
              })
            }
          })

          items.push(...uniqueItems.values())
          console.log(`[API] Constructed ${items.length} items from review history`)
        }
      } catch (error) {
        reviewLogger.warn('Failed to fetch review history:', error)
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

    // Return empty array if no data instead of mock data
    if (items.length === 0) {
      reviewLogger.info('No progress data found for user:', userId)
      return []
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
    return []
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