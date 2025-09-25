import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { UpdateDeckRequest } from '@/types/flashcards';

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

    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks')
      .doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = {
      id: deckDoc.id,
      ...deckDoc.data()
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

    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks')
      .doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const updates = {
      ...body,
      updatedAt: Date.now()
    };

    await deckRef.update(updates);

    const updatedDeck = {
      id: deckDoc.id,
      ...deckDoc.data(),
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

    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks')
      .doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
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