/**
 * API Routes for individual Anki Deck operations
 *
 * GET /api/anki/decks/[id] - Get a specific Anki deck
 * PUT /api/anki/decks/[id] - Update an Anki deck
 * DELETE /api/anki/decks/[id] - Delete an Anki deck
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/anki/decks/[id] - Get a specific Anki deck
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    const { id: deckId } = await params

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const decision = await getStorageDecision(session)

    // For free users, indicate they should use local storage
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        deck: null,
        storage: {
          location: 'local',
          message: 'Free users should fetch from IndexedDB',
        },
      })
    }

    // Get the deck from Firebase
    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('ankiDecks')
      .doc(deckId)

    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deck = {
      id: deckDoc.id,
      ...deckDoc.data(),
    }

    return NextResponse.json({
      deck,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase,
      },
    })
  } catch (error) {
    console.error('[Anki API] Error fetching deck:', error)
    return NextResponse.json({ error: 'Failed to fetch Anki deck' }, { status: 500 })
  }
}

/**
 * PUT /api/anki/decks/[id] - Update an Anki deck
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    const { id: deckId } = await params

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()
    const decision = await getStorageDecision(session)

    // For free users, just return success (they update locally)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        success: true,
        storage: {
          location: 'local',
          message: 'Free users update in IndexedDB only',
        },
      })
    }

    // Get the existing deck
    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('ankiDecks')
      .doc(deckId)

    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Build update object with only allowed fields
    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    }

    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description

    await deckRef.update(updates)

    // Get the updated deck
    const updatedDoc = await deckRef.get()
    const updatedDeck = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    }

    return createStorageResponse({ deck: updatedDeck }, decision)
  } catch (error: any) {
    console.error('[Anki API] Error updating deck:', error)
    return NextResponse.json(
      {
        error: 'Failed to update Anki deck',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/anki/decks/[id] - Delete an Anki deck
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    const { id: deckId } = await params

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const decision = await getStorageDecision(session)

    // For free users, just return success (they delete locally)
    if (!decision.shouldWriteToFirebase) {
      return NextResponse.json({
        success: true,
        storage: {
          location: 'local',
          message: 'Free users delete from IndexedDB only',
        },
      })
    }

    // Get the deck to verify ownership
    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('ankiDecks')
      .doc(deckId)

    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    // Delete the deck
    await deckRef.delete()

    console.log('[Anki API] Deck deleted:', deckId)

    return NextResponse.json({
      success: true,
      deletedId: deckId,
      storage: {
        location: decision.storageLocation,
        syncEnabled: decision.shouldWriteToFirebase,
      },
    })
  } catch (error: any) {
    console.error('[Anki API] Error deleting deck:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete Anki deck',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
