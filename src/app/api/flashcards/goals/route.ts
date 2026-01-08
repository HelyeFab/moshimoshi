import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])

async function ensurePremium(uid: string) {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const plan = userDoc.data()?.subscription?.plan
  return !!plan && PREMIUM_PLANS.has(plan)
}

const GoalsSchema = z.object({
  cardsToReview: z.number().int().min(1).max(500),
  minutesToStudy: z.number().int().min(1).max(240),
  decksToVisit: z.number().int().min(1).max(50),
  accuracyTarget: z.number().int().min(50).max(100),
})

const GoalsDataSchema = z.object({
  goals: GoalsSchema,
  streak: z.number().int().min(0).optional(),
  lastSessionDate: z.string().optional(), // yyyy-mm-dd
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const db = getAdminDb()
    const doc = await db.collection('flashcardGoals').doc(session.uid).get()

    if (!doc.exists) {
      return NextResponse.json({
        goals: null,
        streak: 0,
        lastSessionDate: null
      })
    }

    const data = doc.data()
    return NextResponse.json({
      goals: data?.goals || null,
      streak: data?.streak ?? 0,
      lastSessionDate: data?.lastSessionDate || null
    })
  } catch (error) {
    console.error('[API Flashcards Goals] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
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

    const parsed = GoalsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid goals payload' }, { status: 400 })
    }

    const db = getAdminDb()
    await db.collection('flashcardGoals').doc(session.uid).set(
      {
        userId: session.uid,
        goals: parsed.data,
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Goals] PUT error', error)
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}
