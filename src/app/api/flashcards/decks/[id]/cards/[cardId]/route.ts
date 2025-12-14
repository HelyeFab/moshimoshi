import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'
import type { FlashcardContent } from '@/types/flashcards'

interface Params {
  params: Promise<{
    id: string
    cardId: string
  }>
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
  }

  for (const card of cards) {
    const status = card.metadata?.status
    switch (status) {
      case 'new':
        baseStats.newCards++
        break
      case 'learning':
        baseStats.learningCards++
        break
      case 'review':
        baseStats.reviewCards++
        break
      case 'mastered':
        baseStats.masteredCards++
        break
    }
  }

  return baseStats
}

// PUT /api/flashcards/decks/[id]/cards/[cardId] - Update a single card (metadata/content)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id, cardId } = await params
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const db = getAdminDb()
    const deckRef = db.collection('flashcardDecks').doc(id)
    const deckDoc = await deckRef.get()

    if (!deckDoc.exists) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const deck = deckDoc.data()
    if (!deck || deck.userId !== session.uid) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const cards: FlashcardContent[] = deck.cards || []
    const cardIndex = cards.findIndex(card => card.id === cardId)

    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const updatedCard: FlashcardContent = {
      ...cards[cardIndex],
      metadata: {
        ...cards[cardIndex].metadata,
        ...(body.metadata || {}),
      },
      front: body.front ? { ...cards[cardIndex].front, ...body.front } : cards[cardIndex].front,
      back: body.back ? { ...cards[cardIndex].back, ...body.back } : cards[cardIndex].back,
    }

    const updatedCards = [...cards]
    updatedCards[cardIndex] = updatedCard

    const updatedStats = recomputeStats(updatedCards, deck.stats)

    await deckRef.update({
      cards: updatedCards,
      stats: updatedStats,
      updatedAt: Date.now(),
    })

    return NextResponse.json({ card: { ...updatedCard, deckId: id }, stats: updatedStats })
  } catch (error) {
    console.error('Error updating card:', error)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}
