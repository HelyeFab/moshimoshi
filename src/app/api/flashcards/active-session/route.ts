import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])

async function ensurePremium(uid: string): Promise<boolean> {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const plan = userDoc.data()?.subscription?.plan
  return !!plan && PREMIUM_PLANS.has(plan)
}

const PersistedSessionSchema = z.object({
  version: z.number().int(),
  userId: z.string(),
  deckId: z.string(),
  mode: z.string(),
  cardIds: z.array(z.string()),
  currentIndex: z.number().int().min(0),
  responses: z.array(z.tuple([z.string(), z.object({
    correct: z.boolean(),
    difficulty: z.string().optional(),
    responseTime: z.number()
  })])),
  correctCount: z.number().int().min(0),
  incorrectCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  newCardsStudied: z.number().int().min(0),
  learningCardsStudied: z.number().int().min(0),
  reviewCardsStudied: z.number().int().min(0),
  streakCount: z.number().int().min(0),
  bestStreak: z.number().int().min(0),
  totalResponseTime: z.number().int().min(0),
  fastestResponseTime: z.number().int().min(0),
  slowestResponseTime: z.number().int().min(0),
  elapsedTime: z.number().int().min(0),
  pausedTime: z.number().int().min(0),
  isPaused: z.boolean(),
  savedAt: z.number().int(),
  deviceId: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const db = getAdminDb()
    const deckId = new URL(request.url).searchParams.get('deckId')
    if (deckId) {
      const doc = await db
        .collection('users')
        .doc(session.uid)
        .collection('flashcardActiveSessions')
        .doc(deckId)
        .get()

      if (!doc.exists) {
        return NextResponse.json({ session: null })
      }

      return NextResponse.json({ session: doc.data() || null })
    }

    const snapshot = await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardActiveSessions')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ session: null })
    }

    const doc = snapshot.docs[0]
    return NextResponse.json({ session: doc.data() || null })
  } catch (error) {
    console.error('[API Flashcards Active Session] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch active session' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PersistedSessionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid session payload' }, { status: 400 })
    }

    if (parsed.data.userId !== session.uid) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 403 })
    }

    const db = getAdminDb()
    await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardActiveSessions')
      .doc(parsed.data.deckId)
      .set(
        {
          ...parsed.data,
          updatedAt: Date.now(),
        },
        { merge: true }
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Active Session] PUT error', error)
    return NextResponse.json({ error: 'Failed to save active session' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const deckId = new URL(request.url).searchParams.get('deckId')
    if (!deckId) {
      return NextResponse.json({ error: 'Missing deckId' }, { status: 400 })
    }

    const db = getAdminDb()
    await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardActiveSessions')
      .doc(deckId)
      .delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Active Session] DELETE error', error)
    return NextResponse.json({ error: 'Failed to delete active session' }, { status: 500 })
  }
}
