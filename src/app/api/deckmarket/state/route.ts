import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { getUserPlan } from '@/lib/entitlements/server'

const DECKMARKET_STATE_COLLECTION = 'deckmarketState'
const DECKMARKET_STATE_DOC = 'current'

async function getStateRef(uid: string) {
  const db = getAdminDb()
  return db
    .collection('users')
    .doc(uid)
    .collection(DECKMARKET_STATE_COLLECTION)
    .doc(DECKMARKET_STATE_DOC)
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stateRef = await getStateRef(session.uid)
    const snapshot = await stateRef.get()

    if (!snapshot.exists) {
      return NextResponse.json({ deckId: null })
    }

    const data = snapshot.data() as { deckId?: unknown; updatedAt?: unknown }
    return NextResponse.json({
      deckId: typeof data?.deckId === 'string' ? data.deckId : null,
      updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : null,
    })
  } catch (error) {
    console.error('[DeckMarket State] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deckmarket state' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = await getUserPlan(session.uid)
    if (plan !== 'free') {
      return NextResponse.json({ error: 'Only free users can update deckmarket state' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const deckId = body?.deckId

    if (typeof deckId !== 'string' || !deckId.trim()) {
      return NextResponse.json({ error: 'Invalid request - deckId is required' }, { status: 400 })
    }

    const stateRef = await getStateRef(session.uid)
    const payload = {
      deckId: deckId.trim(),
      updatedAt: Date.now(),
    }

    await stateRef.set(payload, { merge: true })
    return NextResponse.json({ success: true, ...payload })
  } catch (error) {
    console.error('[DeckMarket State] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update deckmarket state' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = await getUserPlan(session.uid)
    if (plan !== 'free') {
      return NextResponse.json({ error: 'Only free users can delete deckmarket state' }, { status: 403 })
    }

    const stateRef = await getStateRef(session.uid)
    await stateRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DeckMarket State] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete deckmarket state' }, { status: 500 })
  }
}
