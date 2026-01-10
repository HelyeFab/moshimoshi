import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

const PREMIUM_PLANS = new Set(['premium_monthly', 'premium_yearly'])

async function ensurePremium(uid: string): Promise<boolean> {
  const db = getAdminDb()
  const userDoc = await db.collection('users').doc(uid).get()
  const plan = userDoc.data()?.subscription?.plan
  return !!plan && PREMIUM_PLANS.has(plan)
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

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required' }, { status: 403 })
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

    if (!(await ensurePremium(session.uid))) {
      return NextResponse.json({ error: 'Premium required' }, { status: 403 })
    }

    const { decks } = await request.json()

    if (!Array.isArray(decks)) {
      return NextResponse.json({ error: 'Invalid request - decks must be an array' }, { status: 400 })
    }

    const db = getAdminDb()
    let synced = 0,
      conflicts = 0,
      skipped = 0

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
        const existing = await ref.get()

        if (existing.exists) {
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
