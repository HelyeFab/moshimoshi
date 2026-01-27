import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getUserPlan } from '@/lib/entitlements/server'
import { KanjiMasterySession } from '@/lib/review-engine/progress/KanjiMasteryProgressManager'

export async function POST(request: NextRequest) {
  try {
    // Get user from session
    const session = await requireAuth()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json() as KanjiMasterySession

    // Validate session data
    if (!body.sessionId || !body.kanji || body.kanji.length === 0) {
      return NextResponse.json(
        { error: 'Invalid session data' },
        { status: 400 }
      )
    }

    const plan = await getUserPlan(session.uid)
    const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly'

    // Only save to Firebase for premium users
    if (isPremium && adminDb) {
      try {
        // Save session to Firebase
        const sessionRef = adminDb
          .collection('users')
          .doc(session.uid)
          .collection('kanji_mastery_sessions')
          .doc(body.sessionId)

        const existingSession = await sessionRef.get()
        if (existingSession.exists) {
          return NextResponse.json({
            success: true,
            sessionId: body.sessionId,
            isPremium,
            message: 'Session already saved'
          })
        }

        await sessionRef.set({
          ...body,
          userId: session.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        // Update user statistics
        const userStatsRef = adminDb
          .collection('users')
          .doc(session.uid)
          .collection('statistics')
          .doc('kanji_mastery')

        const statsSnapshot = await userStatsRef.get()
        const currentStats = statsSnapshot.exists ? statsSnapshot.data() : {}

        const newStats = {
          totalSessions: (currentStats?.totalSessions || 0) + 1,
          totalKanjiLearned: (currentStats?.totalKanjiLearned || 0) + body.kanji.length,
          lastSessionDate: new Date().toISOString(),
          averageAccuracy: currentStats?.averageAccuracy
            ? (currentStats.averageAccuracy + body.sessionStats.averageAccuracy) / 2
            : body.sessionStats.averageAccuracy,
          perfectSessions: body.sessionStats.averageAccuracy === 1
            ? (currentStats?.perfectSessions || 0) + 1
            : (currentStats?.perfectSessions || 0)
        }

        await userStatsRef.set(newStats, { merge: true })

        // Track individual kanji progress
        for (const kanji of body.kanji) {
          const kanjiRef = adminDb
            .collection('users')
            .doc(session.uid)
            .collection('kanji_progress')
            .doc(kanji.id)

          const kanjiSnapshot = await kanjiRef.get()
          const existingProgress = kanjiSnapshot.exists ? kanjiSnapshot.data() : null

          await kanjiRef.set({
            character: kanji.character,
            lastReviewed: new Date().toISOString(),
            nextReviewDate: kanji.nextReviewDate,
            reviewCount: (existingProgress?.reviewCount || 0) + 1,
            averageScore: existingProgress
              ? (existingProgress.averageScore + kanji.finalScore) / 2
              : kanji.finalScore,
            lastScore: kanji.finalScore,
            rounds: kanji.rounds,
            srsData: kanji.srsData || null,
            level: body.level || null,
            updatedAt: new Date().toISOString()
          }, { merge: true })
        }
      } catch (error) {
        console.error('Error saving to Firebase:', error)
        // Continue even if Firebase fails - data is saved in IndexedDB
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      sessionId: body.sessionId,
      isPremium,
      message: isPremium
        ? 'Session saved to cloud storage'
        : 'Session saved locally'
    })

  } catch (error) {
    console.error('Error in kanji-mastery session route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const session = await getSession()

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const plan = await getUserPlan(session.uid)
    const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly'

    // Only fetch from Firebase for premium users
    if (!isPremium || !adminDb) {
      return NextResponse.json({
        sessions: [],
        message: 'Premium subscription required for cloud storage'
      })
    }

    const levelTotals: Record<string, number> = {
      N5: 80,
      N4: 170,
      N3: 370,
      N2: 380,
      N1: 1200
    }

    // Fetch recent sessions from Firebase
    const sessionsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_mastery_sessions')
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get()

    const sessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Fetch statistics
    const statsRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('statistics')
      .doc('kanji_mastery')

    const statsSnapshot = await statsRef.get()
    const stats = statsSnapshot.exists ? statsSnapshot.data() : null

    // Aggregate progress by level using kanji_progress collection
    const progressSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_progress')
      .select('level', 'srsData', 'kanjiId', 'character', 'lastReviewed')
      .get()

    const levelProgress: Record<string, { studied: number; total: number; mastered: number }> =
      Object.fromEntries(Object.entries(levelTotals).map(([level, total]) => [
        level,
        { studied: 0, total, mastered: 0 }
      ]))

    let totalStudied = 0
    let totalMastered = 0

    // Collect individual kanji progress for the response
    const kanjiProgress: Array<{
      character: string
      level?: string
      lastReviewed: string
      srsStatus?: string
    }> = []

    progressSnapshot.forEach(doc => {
      const data = doc.data() as {
        level?: string
        srsData?: { status?: string }
        character?: string
        lastReviewed?: string
      }
      totalStudied += 1

      const level = data.level
      if (level && levelProgress[level]) {
        levelProgress[level].studied += 1
      }

      if (data.srsData?.status === 'mastered') {
        totalMastered += 1
        if (level && levelProgress[level]) {
          levelProgress[level].mastered += 1
        }
      }

      // Add to kanji progress array
      kanjiProgress.push({
        character: data.character || doc.id,
        level: data.level,
        lastReviewed: data.lastReviewed || new Date().toISOString(),
        srsStatus: data.srsData?.status
      })
    })

    const averageAccuracyPercent = Math.round(Math.max(0, stats?.averageAccuracy || 0) * 100)

    const sessionDates = sessions
      .map((sessionDoc: any) => sessionDoc.endTime || sessionDoc.createdAt)
      .filter(Boolean)

    const computeStreak = (dates: string[]) => {
      if (dates.length === 0) {
        return { streakDays: 0, lastStudyDate: null }
      }

      const toDayKey = (dateStr: string) => {
        const date = new Date(dateStr)
        if (Number.isNaN(date.getTime())) return null
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
      }

      const uniqueDays = Array.from(
        new Set(dates.map(toDayKey).filter((value): value is number => value !== null))
      ).sort((a, b) => b - a)

      if (uniqueDays.length === 0) {
        return { streakDays: 0, lastStudyDate: null }
      }

      let streak = 1
      for (let i = 0; i < uniqueDays.length - 1; i += 1) {
        const current = uniqueDays[i]
        const next = uniqueDays[i + 1]
        const dayDiff = (current - next) / (24 * 60 * 60 * 1000)
        if (dayDiff === 1) {
          streak += 1
        } else {
          break
        }
      }

      return {
        streakDays: streak,
        lastStudyDate: new Date(uniqueDays[0]).toISOString()
      }
    }

    const { streakDays, lastStudyDate } = computeStreak(sessionDates as string[])

    return NextResponse.json({
      sessions,
      statistics: stats,
      progressSummary: {
        totalStudied,
        totalMastered,
        averageAccuracy: averageAccuracyPercent,
        streakDays,
        lastStudyDate: lastStudyDate || stats?.lastSessionDate || null,
        levelProgress
      },
      kanjiProgress,
      isPremium
    })

  } catch (error) {
    console.error('Error fetching kanji-mastery sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
