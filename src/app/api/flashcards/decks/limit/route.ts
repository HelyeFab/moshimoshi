/**
 * API Route for checking deck creation limits
 *
 * GET /api/flashcards/decks/limit - Check if user can create more decks
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import featuresConfig from '../../../../../../config/features.v1.json'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Get user's plan
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'

    // Get current deck count
    const totalDecksSnapshot = await adminDb
      .collection('flashcardDecks')
      .where('userId', '==', session.uid)
      .count()
      .get()

    const currentCount = totalDecksSnapshot.data().count

    // Get limits based on plan
    const limits = featuresConfig.limits as Record<string, { monthly?: Record<string, number> }>
    const planLimits = limits[plan] || limits.free
    const maxDecks = planLimits.monthly?.flashcard_decks ?? 15

    const canCreate = maxDecks === -1 || currentCount < maxDecks

    return NextResponse.json({
      canCreate,
      currentCount,
      limit: maxDecks,
      plan,
    })
  } catch (error: any) {
    console.error('[Deck Limit API] Error checking limit:', error)
    return NextResponse.json(
      { error: 'Failed to check deck limit' },
      { status: 500 }
    )
  }
}
