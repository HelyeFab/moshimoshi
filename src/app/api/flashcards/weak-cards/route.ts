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

const WeakCardEntrySchema = z.object({
  cardId: z.string().min(1),
  difficulty: z.enum(['again', 'hard']),
})

const WeakCardsPayloadSchema = z.object({
  deckId: z.string().min(1),
  entries: z.array(WeakCardEntrySchema).max(200),
})

const WeakCardsDeleteSchema = z.object({
  deckId: z.string().min(1),
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
    const snapshot = await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardWeakCards')
      .get()

    const items = snapshot.docs.map(doc => ({
      deckId: doc.id,
      entries: doc.data()?.entries || [],
      updatedAt: doc.data()?.updatedAt || 0,
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[API Flashcards Weak Cards] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch weak cards' }, { status: 500 })
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

    const parsed = WeakCardsPayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid weak cards payload' }, { status: 400 })
    }

    const { deckId, entries } = parsed.data
    const db = getAdminDb()
    await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardWeakCards')
      .doc(deckId)
      .set(
        {
          userId: session.uid,
          entries,
          updatedAt: Date.now(),
        },
        { merge: true }
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Weak Cards] PUT error', error)
    return NextResponse.json({ error: 'Failed to save weak cards' }, { status: 500 })
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

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = WeakCardsDeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid delete payload' }, { status: 400 })
    }

    const db = getAdminDb()
    await db
      .collection('users')
      .doc(session.uid)
      .collection('flashcardWeakCards')
      .doc(parsed.data.deckId)
      .delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Weak Cards] DELETE error', error)
    return NextResponse.json({ error: 'Failed to delete weak cards' }, { status: 500 })
  }
}
