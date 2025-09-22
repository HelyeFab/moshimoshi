import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { reviewLogger } from '@/lib/monitoring/logger'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession()
    const userId = session?.userId || 'guest'
    const isPremium = session?.tier?.includes('premium') || false

    // For guest/free users, return basic stats (they should use IndexedDB locally)
    if (userId === 'guest' || !isPremium) {
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
    }

    // For premium users, aggregate from Firebase
    const stats = await aggregateUserStats(userId)
    return NextResponse.json(stats)
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
    // Fetch progress data from Firebase
    const progressRef = collection(db, 'progress')
    const q = query(progressRef, where('userId', '==', userId))
    const snapshot = await getDocs(q)

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
      kana: { studied: 0, learned: 0, mastered: 0 },
      kanji: { studied: 0, learned: 0, mastered: 0 },
      vocabulary: { studied: 0, learned: 0, mastered: 0 },
      sentence: { studied: 0, learned: 0, mastered: 0 }
    }

    snapshot.forEach(doc => {
      const data = doc.data()
      const contentType = data.contentType || 'vocabulary'

      totalStudied++
      if (contentBreakdown[contentType]) {
        contentBreakdown[contentType].studied++
      }

      // Determine status
      const status = data.status || 'new'
      if (status === 'new') {
        newItems++
      } else if (status === 'learning') {
        learningItems++
      } else if (status === 'review') {
        totalLearned++
        if (contentBreakdown[contentType]) {
          contentBreakdown[contentType].learned++
        }
      } else if (status === 'mastered') {
        totalMastered++
        totalLearned++
        if (contentBreakdown[contentType]) {
          contentBreakdown[contentType].mastered++
          contentBreakdown[contentType].learned++
        }
      }

      // Check due dates
      if (data.nextReviewAt) {
        const reviewDate = data.nextReviewAt.toDate ? data.nextReviewAt.toDate() : new Date(data.nextReviewAt)
        if (reviewDate <= now) dueNow++
        if (reviewDate <= tomorrow) dueToday++
        if (reviewDate > tomorrow && reviewDate <= new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
          dueTomorrow++
        }
        if (reviewDate <= weekEnd) dueThisWeek++
      }
    })

    // Fetch streak data
    const streakDoc = await getDocs(query(
      collection(db, 'streaks'),
      where('userId', '==', userId)
    ))

    let streakDays = 0
    let bestStreak = 0
    if (!streakDoc.empty) {
      const streakData = streakDoc.docs[0].data()
      streakDays = streakData.currentStreak || 0
      bestStreak = streakData.bestStreak || 0
    }

    // Calculate today's progress
    const todayStart = new Date(today)
    const todayEnd = new Date(tomorrow)
    const sessionsRef = collection(db, 'sessions')
    const todayQuery = query(
      sessionsRef,
      where('userId', '==', userId),
      where('startedAt', '>=', todayStart),
      where('startedAt', '<', todayEnd)
    )
    const todaySessions = await getDocs(todayQuery)
    let todaysProgress = 0
    todaySessions.forEach(doc => {
      const data = doc.data()
      todaysProgress += data.itemsCompleted || 0
    })

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