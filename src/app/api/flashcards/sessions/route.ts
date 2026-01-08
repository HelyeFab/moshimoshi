import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])

async function ensurePremium(uid: string) {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const plan = userDoc.data()?.subscription?.plan
  if (!plan || !PREMIUM_PLANS.has(plan)) {
    return false
  }
  return true
}

function toDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0]
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

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
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

    return NextResponse.json({ success: true, session: payload })
  } catch (error) {
    console.error('[API Flashcards Sessions] POST error', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}
