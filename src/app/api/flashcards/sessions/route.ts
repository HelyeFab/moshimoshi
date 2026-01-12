import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

async function requireFlashcardsEntitlement(uid: string) {
  const plan = await getUserPlan(uid)
  const nowUtcISO = new Date().toISOString()
  const { decision } = await evaluateFeatureAccess({
    featureId: 'flashcards',
    userId: uid,
    plan,
    nowUtcISO
  })

  return { plan, nowUtcISO, decision }
}

function toDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0]
}

/**
 * Update flashcard streak based on session date
 * Logic: Simple 1+1+0 progression
 * - Same day: no change
 * - Yesterday: +1
 * - Gap (2+ days): reset to 1
 */
async function updateFlashcardStreak(userId: string, sessionDate: string, db: any) {
  const goalsRef = db.collection('flashcardGoals').doc(userId)

  try {
    await db.runTransaction(async (transaction: any) => {
      const goalsDoc = await transaction.get(goalsRef)
      const data = goalsDoc.exists ? goalsDoc.data() : {}

      const currentStreak = data.streak ?? 0
      const lastSessionDate = data.lastSessionDate || null

      let newStreak = currentStreak

      if (!lastSessionDate) {
        // First session ever
        newStreak = 1
      } else if (lastSessionDate === sessionDate) {
        // Same day - no change
        newStreak = currentStreak
      } else {
        // Calculate day difference
        const lastDate = new Date(lastSessionDate + 'T00:00:00Z')
        const currentDate = new Date(sessionDate + 'T00:00:00Z')
        const daysDiff = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysDiff === 1) {
          // Yesterday - increment
          newStreak = currentStreak + 1
        } else {
          // Gap - reset to 1
          newStreak = 1
        }
      }

      // Update streak and last session date
      transaction.set(goalsRef, {
        ...data,
        streak: newStreak,
        lastSessionDate: sessionDate,
        updatedAt: Date.now()
      }, { merge: true })

      console.log('[Flashcard Streak] Updated:', {
        userId,
        sessionDate,
        lastSessionDate,
        oldStreak: currentStreak,
        newStreak
      })
    })
  } catch (error) {
    console.error('[Flashcard Streak] Failed to update:', error)
    // Don't throw - failing to update streak shouldn't break session save
  }
}

/**
 * POST /api/flashcards/sessions
 * Save flashcard session stats to Firebase (premium users only)
 * Restored from git history - following existing pattern
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entitlement = await requireFlashcardsEntitlement(session.uid)
    if (!entitlement.decision.allow) {
      return NextResponse.json(
        {
          error:
            entitlement.decision.reason === 'limit_reached'
              ? 'Daily limit reached'
              : 'Access denied',
          decision: entitlement.decision
        },
        { status: entitlement.decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    const reviewAccess = await evaluateFeatureAccess({
      featureId: 'flashcard_daily_reviews',
      userId: session.uid,
      plan: entitlement.plan,
      nowUtcISO: entitlement.nowUtcISO
    })

    if (!reviewAccess.decision.allow) {
      return NextResponse.json(
        {
          error: reviewAccess.decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          decision: reviewAccess.decision
        },
        { status: reviewAccess.decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    const payload = await request.json()

    if (payload.userId !== session.uid) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 })
    }

    const db = getAdminDb()
    const docId = payload.id || db.collection('flashcardSessions').doc().id
    const now = Date.now()

    await db
      .collection('flashcardSessions')
      .doc(docId)
      .set({
        ...payload,
        createdAt: now,
        updatedAt: now,
      })

    // Update daily analytics
    const dateKey = toDateKey(payload.timestamp)
    const analyticsRef = db
      .collection('flashcardSessionAnalytics')
      .doc(payload.userId)
      .collection('days')
      .doc(dateKey)

    await db.runTransaction(async tx => {
      const snap = await tx.get(analyticsRef)
      const existing = snap.exists ? snap.data() : null
      const update = {
        userId: payload.userId,
        date: dateKey,
        totalSessions: (existing?.totalSessions || 0) + 1,
        totalCards: (existing?.totalCards || 0) + payload.cardsStudied,
        totalTime: (existing?.totalTime || 0) + payload.duration,
        averageAccuracy:
          existing && existing.totalSessions > 0
            ? ((existing.averageAccuracy * existing.totalSessions + payload.accuracy) /
              (existing.totalSessions + 1))
            : payload.accuracy,
        decksStudied: Array.from(new Set([...(existing?.decksStudied || []), payload.deckId])),
        updatedAt: now,
      }
      tx.set(analyticsRef, update, { merge: true })
    })

    console.log('[API Flashcards Sessions] Saved session:', {
      userId: payload.userId,
      sessionId: docId,
      deckId: payload.deckId,
      cardsStudied: payload.cardsStudied
    })

    // Update flashcard streak (simple 1+1+0 progression)
    await updateFlashcardStreak(payload.userId, dateKey, db)

    await evaluateFeatureAccess({
      featureId: 'flashcard_daily_reviews',
      userId: session.uid,
      plan: entitlement.plan,
      nowUtcISO: entitlement.nowUtcISO,
      increment: true
    })

    return NextResponse.json({ success: true, session: payload })
  } catch (error) {
    console.error('[API Flashcards Sessions] POST error', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

/**
 * GET /api/flashcards/sessions
 * Fetch recent flashcard sessions from Firebase (premium users only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entitlement = await requireFlashcardsEntitlement(session.uid)
    if (!entitlement.decision.allow) {
      return NextResponse.json(
        {
          error:
            entitlement.decision.reason === 'limit_reached'
              ? 'Daily limit reached'
              : 'Access denied',
          decision: entitlement.decision
        },
        { status: entitlement.decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limitParam = Number(searchParams.get('limit') || 200)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 200

    const db = getAdminDb()
    const snapshot = await db
      .collection('flashcardSessions')
      .where('userId', '==', session.uid)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get()

    const toMillis = (value: any): number | undefined => {
      if (value == null) return undefined
      if (typeof value === 'number') return value
      if (typeof value === 'object') {
        if (typeof value.toMillis === 'function') return value.toMillis()
        if (typeof value.toDate === 'function') return value.toDate().getTime()
        if (typeof value.seconds === 'number') {
          return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)
        }
      }
      return undefined
    }

    const sessions = snapshot.docs.map(doc => {
      const data = doc.data() as Record<string, any>
      return {
        id: doc.id,
        ...data,
        timestamp: toMillis(data.timestamp) ?? data.timestamp,
        createdAt: toMillis(data.createdAt) ?? data.createdAt,
        updatedAt: toMillis(data.updatedAt) ?? data.updatedAt,
      }
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('[API Flashcards Sessions] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}
