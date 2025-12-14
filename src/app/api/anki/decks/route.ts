/**
 * API Routes for Anki Decks
 *
 * GET /api/anki/decks - Get all user's Anki-imported decks
 * POST /api/anki/decks - Save a new imported Anki deck
 *
 * Storage Strategy:
 * - Free users: Returns empty array (should use IndexedDB)
 * - Premium users: Firebase + IndexedDB sync (unified with flashcardDecks)
 *
 * Note: Anki decks are now stored in flashcardDecks collection with source='anki'
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'
import { cleanFirestoreData } from '@/lib/utils/cleanFirestoreData'
import { v4 as uuidv4 } from 'uuid'
import featuresConfig from '../../../../../config/features.v1.json'

/**
 * GET /api/anki/decks - Get all user's Anki-imported decks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const decision = await getStorageDecision(session)

    // For free users, return empty with local storage indicator
    if (!decision.shouldWriteToFirebase) {
      console.log('[Anki API] Free user - should use local storage:', session.uid)
      return NextResponse.json({
        decks: [],
        storage: {
          location: 'local',
          message: 'Free users should fetch from IndexedDB',
        },
      })
    }

    // Get user's Anki-imported decks from flashcardDecks collection (source='anki')
    const decksRef = adminDb.collection('flashcardDecks')
    const snapshot = await decksRef
      .where('userId', '==', session.uid)
      .where('source', '==', 'anki')
      .orderBy('updatedAt', 'desc')
      .get()

    const decks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))

    return NextResponse.json({
      decks,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase,
      },
    })
  } catch (error: any) {
    console.error('[Anki API] Error fetching decks:', error)
    // Check if it's a missing index error
    if (error?.code === 9 || error?.message?.includes('index')) {
      console.error('FIRESTORE INDEX MISSING: Please run `firebase deploy --only firestore:indexes`')
      return NextResponse.json({
        error: 'Database index not ready. Please wait a few minutes and try again.',
        details: 'Missing composite index for flashcardDecks collection (userId, source, updatedAt)',
      }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to fetch Anki decks' }, { status: 500 })
  }
}

/**
 * POST /api/anki/decks - Save a new imported Anki deck
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.cards) {
      return NextResponse.json(
        { error: 'Missing required fields: name and cards' },
        { status: 400 }
      )
    }

    // Check Anki import limits (same pattern as flashcards - check BEFORE storage decision)
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'

    // Get current TOTAL deck count (Anki + regular flashcards combined)
    const totalDecksSnapshot = await adminDb
      .collection('flashcardDecks')
      .where('userId', '==', session.uid)
      .count()
      .get()

    const currentDeckCount = totalDecksSnapshot.data().count

    // Check limits based on plan - use flashcard_decks limit for total decks
    const limits = featuresConfig.limits as Record<string, { monthly?: Record<string, number> }>
    const planLimits = limits[plan] || limits.free
    const maxDecks = planLimits.monthly?.flashcard_decks ?? 15

    console.log('[Anki API] Deck limit check:', { plan, currentDeckCount, maxDecks })

    if (maxDecks !== -1 && currentDeckCount >= maxDecks) {
      return NextResponse.json(
        {
          error: 'Deck limit reached',
          message: `You have reached the limit of ${maxDecks} decks for your plan.`,
          currentCount: currentDeckCount,
          limit: maxDecks,
        },
        { status: 403 }
      )
    }

    // Check storage decision (after limit check)
    const decision = await getStorageDecision(session)

    const now = Date.now()
    const deckId = body.id || uuidv4()

    // Build the deck document (unified with flashcardDecks structure)
    const newDeck = {
      id: deckId,
      userId: session.uid,
      name: body.name,
      description: body.description || '',
      emoji: '📚', // Default emoji for Anki imports
      color: 'secondary',
      cardStyle: 'minimal',
      source: 'anki', // Mark as Anki import for tracking
      cardCount: body.cards?.length || 0,
      cards: body.cards || [],
      settings: body.settings || {
        studyDirection: 'front-to-back',
        autoPlay: body.settings?.autoPlayAudio ?? true,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: body.settings?.newCardsPerDay ?? 20,
        reviewMode: 'srs',
        newCardsPerDay: body.settings?.newCardsPerDay ?? 20,
        reviewsPerDay: body.settings?.reviewsPerDay ?? 100,
      },
      stats: {
        totalCards: body.cards?.length || 0,
        newCards: body.cards?.length || 0,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
      },
      createdAt: body.createdAt || now,
      updatedAt: now,
      metadata: {
        originalFilename: body.metadata?.originalFilename,
        importedAt: body.metadata?.importedAt || new Date().toISOString(),
        hasMedia: body.metadata?.hasMedia || false,
        ankiImport: true,
      },
    }

    // Only save to Firebase for premium users
    if (decision.shouldWriteToFirebase) {
      console.log('[Anki API] Premium user - saving to flashcardDecks:', session.uid)

      // Clean the deck object to remove undefined values
      const cleanedDeck = cleanFirestoreData(newDeck)

      // Save to flashcardDecks collection (unified)
      await adminDb
        .collection('flashcardDecks')
        .doc(deckId)
        .set(cleanedDeck)

      console.log('[Anki API] Deck saved to Firebase (flashcardDecks):', deckId)

      // Update usage tracking
      const today = new Date().toISOString().split('T')[0]
      const usageRef = adminDb.collection('users').doc(session.uid).collection('usage').doc(today)
      const currentUsage = (await usageRef.get()).data()
      await usageRef.set(
        {
          anki_imports: {
            created: (currentUsage?.anki_imports?.created || 0) + 1,
          },
          updatedAt: now,
        },
        { merge: true }
      )
    } else {
      console.log('[Anki API] Free user - returning deck for local storage:', session.uid)
    }

    return createStorageResponse({ deck: newDeck }, decision)
  } catch (error: any) {
    console.error('[Anki API] Error saving deck:', error)
    return NextResponse.json(
      {
        error: 'Failed to save Anki deck',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
