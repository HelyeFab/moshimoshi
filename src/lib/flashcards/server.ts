/**
 * Server-side auth data fetcher for Flashcards
 *
 * This module fetches ONLY auth/session data on the server before page render,
 * eliminating the race condition where isPremium is undefined on first load.
 *
 * NOTE: All deck/card data is loaded from IndexedDB client-side (local-only storage)
 */

import 'server-only'
import { getSession, getTierForSession } from '@/lib/auth/session'
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
 * Fetch auth data on the server (NO Firebase deck fetching)
 *
 * Returns:
 * - User session data (userId, tier)
 * - Premium status
 * - Empty arrays (client loads all data from IndexedDB)
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
    // Get authenticated session
    const session = await getSession()

    if (!session) {
      console.log('[FlashcardsServer] No session - returning guest state')
      return emptyState
    }

    // Get tier using Redis-cached lookup
    const tier = await getTierForSession(session)
    const isPremium = tier === 'premium_monthly' || tier === 'premium_yearly'

    console.log('[FlashcardsServer] User:', session.uid, 'Tier:', tier, 'isPremium:', isPremium)

    // Return auth data only - client loads decks/sessions from IndexedDB
    return {
      decks: [],      // Client loads from IndexedDB
      sessions: [],   // Client loads from IndexedDB
      isPremium,
      userId: session.uid,
      tier: tier as Tier,
    }
  } catch (error) {
    console.error('[FlashcardsServer] Error fetching session data:', error)
    return emptyState
  }
}
