import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb, getAdminDb } from '@/lib/firebase/admin';
import type { AddCardRequest, FlashcardContent } from '@/types/flashcards';
import { v4 as uuidv4 } from 'uuid';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

interface Params {
  params: Promise<{
    id: string;
  }>;
}

function recomputeStats(cards: FlashcardContent[], existingStats: any) {
  const baseStats = {
    totalCards: cards.length,
    newCards: 0,
    learningCards: 0,
    reviewCards: 0,
    masteredCards: 0,
    totalStudied: existingStats?.totalStudied || 0,
    averageAccuracy: existingStats?.averageAccuracy || 0,
    currentStreak: existingStats?.currentStreak || 0,
    longestStreak: existingStats?.longestStreak || 0,
    totalTimeSpent: existingStats?.totalTimeSpent || 0,
    lastStudied: existingStats?.lastStudied,
    heatmapData: existingStats?.heatmapData || {}
  };

  for (const card of cards) {
    const status = card.metadata?.status;
    switch (status) {
      case 'new':
        baseStats.newCards++;
        break;
      case 'learning':
        baseStats.learningCards++;
        break;
      case 'review':
        baseStats.reviewCards++;
        break;
      case 'mastered':
        baseStats.masteredCards++;
        break;
    }
  }

  return baseStats;
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

    const db = getDb();
    // Use top-level collection
    const deckRef = db.collection('flashcardDecks').doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = deckDoc.data();
    if (!deck) {
      return NextResponse.json({ error: 'Invalid deck data' }, { status: 500 });
    }

    // Verify ownership
    if (deck.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const newCard: FlashcardContent = {
      id: body.id || uuidv4(),
      front: body.front,
      back: body.back,
      metadata: body.metadata
    };

    // Add card to deck
    const updatedCards = [...(deck.cards || []), newCard];
    const updatedStats = recomputeStats(updatedCards, deck.stats);

    await deckRef.update({
      cards: updatedCards,
      stats: updatedStats,
      updatedAt: Date.now()
    });

    return NextResponse.json({ card: { ...newCard, deckId: id }, stats: updatedStats }, { status: 201 });
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

    const db = getDb();
    // Use top-level collection
    const deckRef = db.collection('flashcardDecks').doc(id);

    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    const deck = deckDoc.data();
    if (!deck) {
      return NextResponse.json({ error: 'Invalid deck data' }, { status: 500 });
    }

    // Verify ownership
    if (deck.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    // Remove card from deck
    const updatedCards = (deck.cards || []).filter((card: FlashcardContent) => card.id !== cardId);
    const updatedStats = recomputeStats(updatedCards, deck.stats);

    await deckRef.update({
      cards: updatedCards,
      stats: updatedStats,
      updatedAt: Date.now()
    });

    return NextResponse.json({ success: true, stats: updatedStats });
  } catch (error) {
    console.error('Error removing card:', error);
    return NextResponse.json(
      { error: 'Failed to remove card' },
      { status: 500 }
    );
  }
}
