import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getUserTier } from '@/lib/auth/tier-utils'
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

    // Get user tier
    const tier = await getUserTier(session.uid)
    const isPremium = tier?.plan === 'premium_monthly' || tier?.plan === 'premium_yearly'

    // Only save to Firebase for premium users
    if (isPremium && adminDb) {
      try {
        // Save session to Firebase
        const sessionRef = adminDb
          .collection('users')
          .doc(session.uid)
          .collection('kanji_mastery_sessions')
          .doc(body.sessionId)

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
          totalXP: (currentStats?.totalXP || 0) + body.totalXP,
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
      totalXP: body.totalXP,
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

    // Get user tier
    const tier = await getUserTier(session.uid)
    const isPremium = tier?.plan === 'premium_monthly' || tier?.plan === 'premium_yearly'

    // Only fetch from Firebase for premium users
    if (!isPremium || !adminDb) {
      return NextResponse.json({
        sessions: [],
        message: 'Premium subscription required for cloud storage'
      })
    }

    // Fetch recent sessions from Firebase
    const sessionsSnapshot = await adminDb
      .collection('users')
      .doc(user.uid)
      .collection('kanji_mastery_sessions')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()

    const sessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Fetch statistics
    const statsRef = adminDb
      .collection('users')
      .doc(user.uid)
      .collection('statistics')
      .doc('kanji_mastery')

    const statsSnapshot = await statsRef.get()
    const stats = statsSnapshot.exists ? statsSnapshot.data() : null

    return NextResponse.json({
      sessions,
      statistics: stats,
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