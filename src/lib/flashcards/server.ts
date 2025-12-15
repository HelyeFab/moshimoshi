/**
 * Server-side data fetcher for Flashcards
 *
 * This module fetches flashcard data on the server before page render,
 * eliminating the race condition where isPremium is undefined on first load.
 */

import 'server-only'
import { getSession, getTierForSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import type { FlashcardDeck, SessionStats } from '@/types/flashcards'

export type Tier = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'

export interface FlashcardsInitialData {
  decks: FlashcardDeck[]
  sessions: SessionStats[]
  isPremium: boolean
  userId: string | null
  tier: Tier
}

/**
 * Fetch initial flashcard data on the server
 *
 * - For guests: returns empty state
 * - For free users: returns empty arrays (they use IndexedDB client-side)
 * - For premium users: fetches decks and sessions from Firebase
 */
export async function getFlashcardsInitialData(): Promise<FlashcardsInitialData> {
  const emptyState: FlashcardsInitialData = {
    decks: [],
    sessions: [],
    isPremium: false,
    userId: null,
    tier: 'guest',
  }

  try {
    // 1. Get authenticated session
    const session = await getSession()

    if (!session) {
      console.log('[FlashcardsServer] No session - returning guest state')
      return emptyState
    }

    // 2. Get tier using Redis-cached lookup
    const tier = await getTierForSession(session)
    const isPremium = tier === 'premium_monthly' || tier === 'premium_yearly'

    console.log('[FlashcardsServer] User:', session.uid, 'Tier:', tier, 'isPremium:', isPremium)

    // 3. For free users, return empty arrays - they load from IndexedDB client-side
    if (!isPremium) {
      return {
        decks: [],
        sessions: [],
        isPremium: false,
        userId: session.uid,
        tier: tier as Tier,
      }
    }

    // 4. For premium users, fetch from Firebase
    if (!adminDb) {
      console.error('[FlashcardsServer] adminDb not available')
      return {
        decks: [],
        sessions: [],
        isPremium,
        userId: session.uid,
        tier: tier as Tier,
      }
    }

    // 5. Fetch decks from flashcardDecks collection
    const decksSnapshot = await adminDb
      .collection('flashcardDecks')
      .where('userId', '==', session.uid)
      .orderBy('updatedAt', 'desc')
      .get()

    const decks: FlashcardDeck[] = decksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FlashcardDeck[]

    console.log('[FlashcardsServer] Fetched', decks.length, 'decks for premium user')

    // 6. Fetch recent sessions for stats dashboard
    const sessionsSnapshot = await adminDb
      .collection('flashcardSessions')
      .where('userId', '==', session.uid)
      .orderBy('timestamp', 'desc')
      .limit(25)
      .get()

    const sessions: SessionStats[] = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SessionStats[]

    console.log('[FlashcardsServer] Fetched', sessions.length, 'sessions for premium user')

    return {
      decks,
      sessions,
      isPremium,
      userId: session.uid,
      tier: tier as Tier,
    }
  } catch (error) {
    console.error('[FlashcardsServer] Error fetching initial data:', error)

    // Return empty state on error - client will attempt IndexedDB fallback
    return emptyState
  }
}
