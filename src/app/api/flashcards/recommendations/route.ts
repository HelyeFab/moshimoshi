import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { isFlashcardsPremiumUser } from '@/app/api/flashcards/_lib/entitlements'

const RecommendationSchema = z.object({
  deckId: z.string().min(1),
  deckName: z.string().min(1),
  reason: z.string().min(1),
  urgency: z.enum(['high', 'medium', 'low']),
  estimatedTime: z.number().int().nonnegative(),
  dueCards: z.number().int().nonnegative(),
})

const PayloadSchema = z.object({
  recommendations: z.array(RecommendationSchema).max(10),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isFlashcardsPremiumUser(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const db = getAdminDb()
    const doc = await db.collection('flashcardRecommendations').doc(session.uid).get()

    if (!doc.exists) {
      return NextResponse.json({ recommendations: [] })
    }

    return NextResponse.json({ recommendations: doc.data()?.recommendations || [] })
  } catch (error) {
    console.error('[API Flashcards Recommendations] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isFlashcardsPremiumUser(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = PayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid recommendations payload' }, { status: 400 })
    }

    const db = getAdminDb()
    await db.collection('flashcardRecommendations').doc(session.uid).set(
      {
        userId: session.uid,
        recommendations: parsed.data.recommendations,
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Recommendations] PUT error', error)
    return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 })
  }
}
