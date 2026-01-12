import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import type { FlashcardContent } from '@/types/flashcards'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb

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

  return { decision }
}

// Remove undefined values from an object (Firestore doesn't accept undefined)
function removeUndefined<T extends Record<string, any>>(obj: T): T {
  const result = {} as T
  for (const key in obj) {
    if (obj[key] !== undefined) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        result[key] = removeUndefined(obj[key])
      } else {
        result[key] = obj[key]
      }
    }
  }
  return result
}

/**
 * POST /api/flashcards/decks/[deckId]/progress
 * Sync deck stats and card SRS metadata to Firebase (premium users only)
 * Called at end of study session to batch sync all progress
 */
export async function POST(request: NextRequest, { params }: Params) {
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

    const body = await request.json()
    const { deckStats, cardUpdates } = body

    if (!deckStats || !cardUpdates || !Array.isArray(cardUpdates)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected { deckStats, cardUpdates }' },
        { status: 400 }
      )
    }

    const db = getDb()
    const deckRef = db.collection('flashcardDecks').doc(deckId)

    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deck = deckDoc.data()
    if (!deck) {
      return NextResponse.json({ error: 'Invalid deck data' }, { status: 500 })
    }

    // Verify ownership
    if (deck.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Update deck stats (merge with existing stats)
    const updatedStats = {
      ...deck.stats,
      ...removeUndefined(deckStats),
      updatedAt: Date.now()
    }

    // Update card metadata for cards that were reviewed in this session
    const updatedCards = (deck.cards || []).map((card: FlashcardContent) => {
      // Find if this card was updated in the session
      const cardUpdate = cardUpdates.find((u: any) => u.cardId === card.id)

      if (!cardUpdate) {
        return card // No changes for this card
      }

      // Merge SRS metadata (only the fields that were provided)
      return {
        ...card,
        metadata: {
          ...card.metadata,
          ...removeUndefined(cardUpdate.metadata)
        }
      }
    })

    // Update deck with new stats and card metadata
    await deckRef.update({
      stats: updatedStats,
      cards: updatedCards,
      updatedAt: Date.now()
    })

    console.log('[API Flashcards Deck Progress] Synced progress:', {
      deckId,
      userId: session.uid,
      cardsUpdated: cardUpdates.length,
      deckStats: {
        totalTimeSpent: updatedStats.totalTimeSpent,
        lastStudied: updatedStats.lastStudied
      }
    })

    return NextResponse.json({
      success: true,
      cardsUpdated: cardUpdates.length,
      stats: updatedStats
    })
  } catch (error) {
    console.error('[API Flashcards Deck Progress] POST error', error)
    return NextResponse.json({ error: 'Failed to sync progress' }, { status: 500 })
  }
}
