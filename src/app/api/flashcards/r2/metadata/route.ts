import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb, FieldValue } from '@/lib/firebase/admin'
import { z } from 'zod'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

const MetadataSchema = z.object({
  deckId: z.string().min(1),
  name: z.string().min(1),
  cardCount: z.number().int().nonnegative(),
  hasMedia: z.boolean(),
  totalBytes: z.number().int().nonnegative(),
  r2Keys: z.object({
    cardsKey: z.string(),
    manifestKey: z.string(),
    mediaPrefix: z.string()
  })
})

function isValidR2Key(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false
  if (key.startsWith('/')) return false
  if (key.includes('..')) return false
  if (key.includes('\\')) return false
  return true
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getAdminDb()
    const plan = await getUserPlan(session.uid)
    const nowUtcISO = new Date().toISOString()
    const { decision } = await evaluateFeatureAccess({
      featureId: 'flashcards',
      userId: session.uid,
      plan,
      nowUtcISO
    })

    if (!decision.allow) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          decision
        },
        { status: decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    // 3. Validate request
    const body = await request.json()
    const validation = MetadataSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({
        error: 'Invalid metadata',
        details: validation.error.issues
      }, { status: 400 })
    }

    const { deckId, name, cardCount, hasMedia, totalBytes, r2Keys } = validation.data

    const prefix = `users/${session.uid}/flashcards/${deckId}/`
    if (
      !isValidR2Key(r2Keys.cardsKey, prefix) ||
      !isValidR2Key(r2Keys.manifestKey, prefix) ||
      !isValidR2Key(r2Keys.mediaPrefix, prefix)
    ) {
      return NextResponse.json({ error: 'Invalid R2 key prefix' }, { status: 400 })
    }

    // 4. Write deck metadata to Firestore
    const metadataDoc = {
      deckId,
      userId: session.uid,
      name,
      cardCount,
      hasMedia,
      totalBytes,
      r2: r2Keys,
      source: 'user',  // CRITICAL: Distinguish from Anki decks
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    }

    try {
      await db.collection('userFlashcardDecks').doc(deckId).set(metadataDoc, { merge: true })
    } catch (error) {
      console.error('[metadata] Error writing deck metadata:', error)
      return NextResponse.json({ error: 'Failed to save deck metadata' }, { status: 500 })
    }

    // 5. Update user's R2 usage
    try {
      await db.collection('r2Usage').doc(session.uid).set({
        totalBytes: FieldValue.increment(totalBytes),
        lastUpdated: FieldValue.serverTimestamp()
      }, { merge: true })
    } catch (error) {
      console.error('[metadata] Error updating R2 usage:', error)
      // Non-fatal - metadata already written
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[metadata] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
