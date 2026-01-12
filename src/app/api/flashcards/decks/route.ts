import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
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

// Helper to remove undefined values (Firestore doesn't accept them)
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
 * GET /api/flashcards/decks
 * Fetch all user's decks from Firebase (premium only)
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

    const db = getAdminDb()
    const snapshot = await db
      .collection('flashcardDecks')
      .where('userId', '==', session.uid)
      .orderBy('updatedAt', 'desc')
      .get()

    const decks = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((d: any) => d.source !== 'anki') // CRITICAL: Filter Anki decks

    console.log('[API Flashcards Decks] GET - Fetched decks:', {
      userId: session.uid,
      total: snapshot.docs.length,
      filtered: decks.length,
      ankiFiltered: snapshot.docs.length - decks.length,
    })

    return NextResponse.json({ decks })
  } catch (error) {
    console.error('[API Flashcards Decks] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 })
  }
}

/**
 * POST /api/flashcards/decks
 * Batch upsert decks to Firebase (premium only)
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

    const { decks } = await request.json()

    if (!Array.isArray(decks)) {
      return NextResponse.json({ error: 'Invalid request - decks must be an array' }, { status: 400 })
    }

    const db = getAdminDb()
    const deckAccess = await evaluateFeatureAccess({
      featureId: 'flashcard_decks',
      userId: session.uid,
      plan: entitlement.plan,
      nowUtcISO: entitlement.nowUtcISO
    })
    let synced = 0,
      conflicts = 0,
      skipped = 0
    let newDecks = 0

    const userDecks = decks.filter((deck: any) => deck.source !== 'anki')
    const deckRefs = userDecks.map((deck: any) => db.collection('flashcardDecks').doc(deck.id))
    const existingSnapshots = deckRefs.length > 0 ? await db.getAll(...deckRefs) : []
    const existingMap = new Map(existingSnapshots.map(doc => [doc.id, doc]))
    for (const deck of userDecks) {
      const existing = existingMap.get(deck.id)
      if (!existing || !existing.exists) {
        newDecks += 1
      }
    }

    if (deckAccess.decision.remaining !== -1 && newDecks > deckAccess.decision.remaining) {
      return NextResponse.json(
        {
          error: 'Monthly deck limit reached',
          decision: deckAccess.decision
        },
        { status: 429 }
      )
    }

    // Process in batches of 50 (Firestore batch limit is 500, using 50 for safety)
    const BATCH_SIZE = 50

    for (let i = 0; i < decks.length; i += BATCH_SIZE) {
      const batch = db.batch()
      const chunk = decks.slice(i, i + BATCH_SIZE)

      for (const deck of chunk) {
        // CRITICAL: Skip Anki decks
        if (deck.source === 'anki') {
          skipped++
          continue
        }

        // Security check: verify ownership
        if (deck.userId !== session.uid) {
          skipped++
          continue
        }

        const ref = db.collection('flashcardDecks').doc(deck.id)
        const existing = existingMap.get(deck.id)

        if (existing?.exists) {
          const existingData = existing.data()

          // LWW conflict resolution using updatedAt timestamp
          if (deck.updatedAt > (existingData?.updatedAt || 0)) {
            batch.set(ref, removeUndefined(deck), { merge: true })
            synced++
          } else {
            conflicts++
          }
        } else {
          // New deck - create
          batch.set(ref, removeUndefined(deck))
          synced++
        }
      }

      await batch.commit()
    }

    if (newDecks > 0) {
      const usageRef = db
        .collection('users')
        .doc(session.uid)
        .collection('usage')
        .doc(deckAccess.bucketKey)
      await usageRef.set(
        {
          flashcard_decks: FieldValue.increment(newDecks),
          lastUpdated: entitlement.nowUtcISO
        },
        { merge: true }
      )
    }

    console.log('[API Flashcards Decks] POST - Batch sync complete:', {
      userId: session.uid,
      total: decks.length,
      synced,
      conflicts,
      skipped,
    })

    return NextResponse.json({ success: true, synced, conflicts, skipped })
  } catch (error) {
    console.error('[API Flashcards Decks] POST error:', error)
    return NextResponse.json({ error: 'Failed to sync decks' }, { status: 500 })
  }
}
