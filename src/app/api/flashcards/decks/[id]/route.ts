import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb, getAdminDb } from '@/lib/firebase/admin';
import type { UpdateDeckRequest } from '@/types/flashcards';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// GET /api/flashcards/decks/[id] - Get a specific deck
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    // Use top-level collection
    const deckRef = db.collection('flashcardDecks').doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Verify ownership
    const deckData = deckDoc.data();
    if (deckData?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = {
      id: deckDoc.id,
      ...deckData
    };

    return NextResponse.json({ deck });
  } catch (error) {
    console.error('Error fetching deck:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deck' },
      { status: 500 }
    );
  }
}

// PUT /api/flashcards/decks/[id] - Update a deck
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateDeckRequest = await request.json();

    const db = getDb();
    // Use top-level collection
    const deckRef = db.collection('flashcardDecks').doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Verify ownership
    const deckData = deckDoc.data();
    if (deckData?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const updates = {
      ...body,
      updatedAt: Date.now()
    };

    await deckRef.update(updates);

    const updatedDeck = {
      id: deckDoc.id,
      ...deckData,
      ...updates
    };

    return NextResponse.json({ deck: updatedDeck });
  } catch (error) {
    console.error('Error updating deck:', error);
    return NextResponse.json(
      { error: 'Failed to update deck' },
      { status: 500 }
    );
  }
}

// DELETE /api/flashcards/decks/[id] - Delete a deck
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    // Use top-level collection
    const deckRef = db.collection('flashcardDecks').doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Verify ownership
    const deckData = deckDoc.data();
    if (deckData?.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    await deckRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting deck:', error);
    return NextResponse.json(
      { error: 'Failed to delete deck' },
      { status: 500 }
    );
  }
}