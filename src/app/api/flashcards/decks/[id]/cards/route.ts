import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { AddCardRequest, FlashcardContent } from '@/types/flashcards';
import { v4 as uuidv4 } from 'uuid';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/flashcards/decks/[id]/cards - Add a card to a deck
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: AddCardRequest = await request.json();

    const deckRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('flashcardDecks')
      .doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = deckDoc.data();
    if (!deck) {
      return NextResponse.json({ error: 'Invalid deck data' }, { status: 500 });
    }

    const newCard: FlashcardContent = {
      id: uuidv4(),
      front: body.front,
      back: body.back,
      metadata: body.metadata
    };

    // Add card to deck
    const updatedCards = [...(deck.cards || []), newCard];
    const updatedStats = {
      ...deck.stats,
      totalCards: updatedCards.length,
      newCards: (deck.stats?.newCards || 0) + 1
    };

    await deckRef.update({
      cards: updatedCards,
      stats: updatedStats,
      updatedAt: Date.now()
    });

    return NextResponse.json({ card: newCard }, { status: 201 });
  } catch (error) {
    console.error('Error adding card:', error);
    return NextResponse.json(
      { error: 'Failed to add card' },
      { status: 500 }
    );
  }
}

// DELETE /api/flashcards/decks/[id]/cards - Remove a card from a deck
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json({ error: 'Card ID required' }, { status: 400 });
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

    const deck = deckDoc.data();
    if (!deck) {
      return NextResponse.json({ error: 'Invalid deck data' }, { status: 500 });
    }

    // Remove card from deck
    const updatedCards = (deck.cards || []).filter((card: FlashcardContent) => card.id !== cardId);
    const updatedStats = {
      ...deck.stats,
      totalCards: updatedCards.length,
      newCards: Math.max(0, (deck.stats?.newCards || 0) - 1)
    };

    await deckRef.update({
      cards: updatedCards,
      stats: updatedStats,
      updatedAt: Date.now()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing card:', error);
    return NextResponse.json(
      { error: 'Failed to remove card' },
      { status: 500 }
    );
  }
}