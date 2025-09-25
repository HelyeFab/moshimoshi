import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { reviewLogger } from '@/lib/monitoring/logger'
import { adminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession()
    const userId = session?.uid || 'guest'

    console.log('[GET /api/review/stats] userId:', userId)

    // CRITICAL: Get fresh user data to check premium status (never trust session.tier!)
    if (userId !== 'guest') {
      const userDoc = await adminDb.collection('users').doc(userId).get()
      const userData = userDoc.data()
      const plan = userData?.subscription?.plan || 'free'
      const isPremium = plan.includes('premium')

      console.log('[GET /api/review/stats] Plan:', plan, 'isPremium:', isPremium)

      // For premium users, aggregate from Firebase
      if (isPremium) {
        const stats = await aggregateUserStats(userId)
        console.log('[GET /api/review/stats] Returning stats:', stats)
        return NextResponse.json(stats)
      }
    }

    // For guest/free users, return basic stats (they should use IndexedDB locally)
    // Return minimal stats for free users
    // Their real data is stored locally in IndexedDB
    return NextResponse.json({
      totalStudied: 0,
      totalLearned: 0,
      totalMastered: 0,
      dueNow: 0,
      dueToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      newItems: 0,
      learningItems: 0,
      streakDays: parseInt(request.headers.get('x-streak') || '0'),
      bestStreak: parseInt(request.headers.get('x-best-streak') || '0'),
      todaysProgress: 0,
      totalReviewTime: 0,
      averageAccuracy: 0,
      contentBreakdown: {
        kana: { studied: 0, learned: 0, mastered: 0 },
        kanji: { studied: 0, learned: 0, mastered: 0 },
        vocabulary: { studied: 0, learned: 0, mastered: 0 },
        sentence: { studied: 0, learned: 0, mastered: 0 }
      },
      message: 'Free users: stats are stored locally'
    })
  } catch (error) {
    reviewLogger.error('Failed to fetch review stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

async function aggregateUserStats(userId: string) {
  try {
    console.log('[aggregateUserStats] Starting aggregation for user:', userId)

    // Fetch SRS data from Firebase - the actual review data
    const srsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('srs_data')
    const srsSnapshot = await srsRef.get()

    console.log('[aggregateUserStats] Found SRS items:', srsSnapshot.size)

    let totalStudied = 0
    let totalLearned = 0
    let totalMastered = 0
    let dueNow = 0
    let dueToday = 0
    let dueTomorrow = 0
    let dueThisWeek = 0
    let newItems = 0
    let learningItems = 0

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const contentBreakdown: any = {
      hiragana: { studied: 0, learned: 0, mastered: 0 },
      katakana: { studied: 0, learned: 0, mastered: 0 },
      kanji: { studied: 0, learned: 0, mastered: 0 },
      vocabulary: { studied: 0, learned: 0, mastered: 0 },
      sentence: { studied: 0, learned: 0, mastered: 0 }
    }

    // Process each SRS item
    srsSnapshot.forEach(doc => {
      const data = doc.data()
      const itemId = doc.id

      // Determine content type from itemId
      let contentType = 'kanji'
      if (itemId.startsWith('hiragana-')) contentType = 'hiragana'
      else if (itemId.startsWith('katakana-')) contentType = 'katakana'
      else if (itemId.includes('vocab')) contentType = 'vocabulary'
      else if (itemId.includes('sentence')) contentType = 'sentence'

      totalStudied++
      if (contentBreakdown[contentType]) {
        contentBreakdown[contentType].studied++
      }

      // Determine item state based on SRS data
      const interval = data.interval || 0
      const repetitions = data.repetitions || 0
      const easeFactor = data.easeFactor || 2.5

      // NEW: Not reviewed yet
      if (repetitions === 0) {
        newItems++
      }
      // LEARNING: interval < 1 day
      else if (interval < 1) {
        learningItems++
      }
      // MASTERED: interval >= 21 days
      else if (interval >= 21) {
        totalMastered++
        totalLearned++
        if (contentBreakdown[contentType]) {
          contentBreakdown[contentType].mastered++
          contentBreakdown[contentType].learned++
        }
      }
      // REVIEW: learned but not mastered
      else {
        totalLearned++
        if (contentBreakdown[contentType]) {
          contentBreakdown[contentType].learned++
        }
      }

      // Check due dates
      if (data.nextReview) {
        const reviewDate = data.nextReview.toDate ? data.nextReview.toDate() : new Date(data.nextReview)

        // Items are due if their review date has passed
        if (reviewDate <= now) dueNow++
        if (reviewDate <= tomorrow) dueToday++
        if (reviewDate > tomorrow && reviewDate <= new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
          dueTomorrow++
        }
        if (reviewDate <= weekEnd) dueThisWeek++
      }
    })

    // Fetch streak data from achievements collection
    const achievementsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('achievements')
      .doc('activities')
    const achievementsDoc = await achievementsRef.get()

    let streakDays = 0
    let bestStreak = 0
    if (achievementsDoc.exists) {
      const achievementsData = achievementsDoc.data()
      streakDays = achievementsData?.currentStreak || 0
      bestStreak = achievementsData?.bestStreak || 0
    }

    // Calculate today's progress from statistics
    const statsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('statistics')
      .doc('overall')
    const statsDoc = await statsRef.get()

    let todaysProgress = 0
    if (statsDoc.exists) {
      const statsData = statsDoc.data()
      // For now, we'll use the total items reviewed today
      // This needs to be filtered by date in a real implementation
      todaysProgress = statsData?.totalItemsReviewed || 0
      // TODO: Filter by today's date from review_history collection
    }

    return {
      totalStudied,
      totalLearned,
      totalMastered,
      dueNow,
      dueToday,
      dueTomorrow: dueTomorrow - dueToday,
      dueThisWeek,
      newItems,
      learningItems,
      streakDays,
      bestStreak,
      todaysProgress,
      todaysGoal: 30,
      totalReviewTime: 0, // Would need to aggregate from sessions
      averageAccuracy: 0.85, // Would need to calculate from sessions
      contentBreakdown
    }
  } catch (error) {
    reviewLogger.error('Failed to aggregate stats from Firebase:', error)
    // Return default stats on error
    return {
      totalStudied: 0,
      totalLearned: 0,
      totalMastered: 0,
      dueNow: 0,
      dueToday: 0,
      dueTomorrow: 0,
      dueThisWeek: 0,
      newItems: 0,
      learningItems: 0,
      streakDays: 0,
      bestStreak: 0,
      todaysProgress: 0,
      todaysGoal: 30,
      totalReviewTime: 0,
      averageAccuracy: 0,
      contentBreakdown: {
        kana: { studied: 0, learned: 0, mastered: 0 },
        kanji: { studied: 0, learned: 0, mastered: 0 },
        vocabulary: { studied: 0, learned: 0, mastered: 0 },
        sentence: { studied: 0, learned: 0, mastered: 0 }
      }
    }
  }
}