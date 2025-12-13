/**
 * API Routes for Anki Decks
 *
 * GET /api/anki/decks - Get all user's Anki decks
 * POST /api/anki/decks - Save a new imported Anki deck
 *
 * Storage Strategy:
 * - Free users: Returns empty array (should use IndexedDB)
 * - Premium users: Firebase + IndexedDB sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'
import { cleanFirestoreData } from '@/lib/utils/cleanFirestoreData'
import { v4 as uuidv4 } from 'uuid'

/**
 * GET /api/anki/decks - Get all user's Anki decks
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

    // Get user's Anki decks from Firebase (premium only) - top-level collection
    const decksRef = adminDb.collection('ankiDecks')
    const snapshot = await decksRef
      .where('userId', '==', session.uid)
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
        details: 'Missing composite index for ankiDecks collection',
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
    const decision = await getStorageDecision(session)

    // Validate required fields
    if (!body.name || !body.cards) {
      return NextResponse.json(
        { error: 'Missing required fields: name and cards' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const deckId = body.id || uuidv4()

    // Build the deck document
    const newDeck = {
      id: deckId,
      userId: session.uid,
      name: body.name,
      description: body.description || '',
      cardCount: body.cards?.length || 0,
      cards: body.cards || [],
      createdAt: body.createdAt || now,
      updatedAt: now,
      metadata: {
        originalFilename: body.metadata?.originalFilename,
        importedAt: body.metadata?.importedAt || new Date().toISOString(),
        hasMedia: body.metadata?.hasMedia || false,
      },
    }

    // Only save to Firebase for premium users
    if (decision.shouldWriteToFirebase) {
      console.log('[Anki API] Premium user - saving to Firebase:', session.uid)

      // Clean the deck object to remove undefined values
      const cleanedDeck = cleanFirestoreData(newDeck)

      // Save to top-level collection
      await adminDb
        .collection('ankiDecks')
        .doc(deckId)
        .set(cleanedDeck)

      console.log('[Anki API] Deck saved to Firebase:', deckId)
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
