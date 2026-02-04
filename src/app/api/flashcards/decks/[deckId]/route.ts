import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

interface Params {
  params: Promise<{
    deckId: string
  }>
}

async function requireFlashcardsEntitlement(uid: string) {
  const plan = await getUserPlan(uid)
  const nowUtcISO = new Date().toISOString()
  const { decision } = await evaluateFeatureAccess({
    featureId: 'flashcards',
    userId: uid,
    plan,
    nowUtcISO
  })

  return { decision, plan }
}

/**
 * GET /api/flashcards/decks/[deckId]
 * Fetch a single deck by ID (premium only)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { deckId } = await params
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

    const db = getAdminDb()
    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deck = deckDoc.data()

    // Verify ownership
    if (deck?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // CRITICAL: Filter out Anki decks
    if (deck.source === 'anki') {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    console.log('[API Flashcards Deck] GET - Fetched deck:', {
      deckId,
      name: deck.name,
      userId: session.uid,
    })

    return NextResponse.json({ deck: { id: deckDoc.id, ...deck } })
  } catch (error) {
    console.error('[API Flashcards Deck] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch deck' }, { status: 500 })
  }
}

/**
 * DELETE /api/flashcards/decks/[deckId]
 * Delete a deck from Firebase (premium only)
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { deckId } = await params
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

    if (entitlement.plan === 'free' || entitlement.plan === 'guest') {
      return NextResponse.json({ error: 'Premium required for deletions' }, { status: 403 })
    }

    const db = getAdminDb()
    const deckDoc = await db.collection('flashcardDecks').doc(deckId).get()

    if (!deckDoc.exists) {
      // Deck already deleted or never existed - this is fine (idempotent)
      console.log('[API Flashcards Deck] DELETE - Deck not found (already deleted):', deckId)
      await db
        .collection('users')
        .doc(session.uid)
        .collection('deletedFlashcardDecks')
        .doc(deckId)
        .set({
          deletedAt: Date.now(),
        })
      return NextResponse.json({ success: true, message: 'Deck already deleted' })
    }

    const deck = deckDoc.data()

    // Verify ownership
    if (deck?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // CRITICAL: Don't allow deleting Anki decks via this endpoint
    // Anki decks should only be managed via R2 flow
    if (deck.source === 'anki') {
      return NextResponse.json({ error: 'Cannot delete Anki decks via this endpoint' }, { status: 400 })
    }

    // Delete the deck
    await db.collection('flashcardDecks').doc(deckId).delete()

    // Record deletion tombstone to prevent resurrection across devices
    await db
      .collection('users')
      .doc(session.uid)
      .collection('deletedFlashcardDecks')
      .doc(deckId)
      .set({
        deletedAt: Date.now(),
      })

    console.log('[API Flashcards Deck] DELETE - Deck deleted:', {
      deckId,
      name: deck.name,
      userId: session.uid,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Flashcards Deck] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 })
  }
}
