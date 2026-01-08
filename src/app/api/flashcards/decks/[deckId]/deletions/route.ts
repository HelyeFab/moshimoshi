import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { FieldValue, getAdminDb } from '@/lib/firebase/admin'

interface Params {
  params: Promise<{
    deckId: string
  }>
}

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])

async function ensurePremium(uid: string) {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const plan = userDoc.data()?.subscription?.plan
  return !!plan && PREMIUM_PLANS.has(plan)
}

const DeleteRequestSchema = z.union([
  z.object({ cardId: z.string().min(1) }),
  z.object({ cardIds: z.array(z.string().min(1)).min(1) }),
])

function getDeletionDocRef(userId: string, deckId: string) {
  const db = getAdminDb()
  return db.collection('flashcardDeckDeletions').doc(userId).collection('decks').doc(deckId)
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const { deckId } = await params
    const doc = await getDeletionDocRef(session.uid, deckId).get()

    if (!doc.exists) {
      return NextResponse.json({ deletedCardIds: [] })
    }

    const data = doc.data()
    const deletedCardIds = Array.isArray(data?.deletedCardIds) ? data.deletedCardIds : []

    return NextResponse.json({ deletedCardIds })
  } catch (error) {
    console.error('[API Flashcards Deck Deletions] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch deletions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required for sync' }, { status: 403 })
    }

    const { deckId } = await params
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = DeleteRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid delete payload' }, { status: 400 })
    }

    const cardIds = 'cardIds' in parsed.data ? parsed.data.cardIds : [parsed.data.cardId]
    const docRef = getDeletionDocRef(session.uid, deckId)

    await docRef.set(
      {
        userId: session.uid,
        deckId,
        deletedCardIds: FieldValue.arrayUnion(...cardIds),
        updatedAt: Date.now(),
      },
      { merge: true }
    )

    return NextResponse.json({ success: true, added: cardIds.length })
  } catch (error) {
    console.error('[API Flashcards Deck Deletions] POST error', error)
    return NextResponse.json({ error: 'Failed to save deletions' }, { status: 500 })
  }
}
