import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query user's flashcard decks
    const db = getAdminDb()

    let snapshot
    try {
      // TODO: Re-enable orderBy after Firestore composite index finishes building
      // Composite index needed: userId (ASC) + updatedAt (DESC)
      snapshot = await db.collection('userFlashcardDecks')
        .where('userId', '==', session.uid)
        // .orderBy('updatedAt', 'desc')  // Temporarily disabled - index building
        .get()
    } catch (error) {
      console.error('[list] Error querying userFlashcardDecks:', error)
      return NextResponse.json({ error: 'Failed to fetch decks' }, { status: 500 })
    }

    const decks = snapshot.docs.map(doc => doc.data())

    return NextResponse.json({ decks })
  } catch (error) {
    console.error('[list] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
