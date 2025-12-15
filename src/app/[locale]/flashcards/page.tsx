import { getFlashcardsInitialData } from '@/lib/flashcards/server'
import FlashcardsContent from './FlashcardsContent'
import { EntitlementGate } from '@/components/review-engine/EntitlementGate'

/**
 * Flashcards Page - Server Component
 *
 * Implements server-side data fetching to eliminate the race condition
 * where isPremium is undefined on first client-side load.
 *
 * Flow:
 * 1. Server: getSession() validates user
 * 2. Server: getTierForSession() determines premium status (Redis cached)
 * 3. Server: For premium users, fetches decks from Firebase
 * 4. Server: Passes initialData to client component
 * 5. Client: Renders immediately with server data (no loading flash)
 * 6. Client: Syncs to IndexedDB for offline support
 */
export default async function FlashcardsPage() {
  let initialData

  try {
    initialData = await getFlashcardsInitialData()
  } catch (error) {
    console.error('[FlashcardsPage] SSR error:', error)
    // Fallback - client will load from IndexedDB
    initialData = {
      decks: [],
      sessions: [],
      isPremium: false,
      userId: null,
      tier: 'guest' as const,
    }
  }

  return (
    <EntitlementGate featureId="flashcards">
      <FlashcardsContent initialData={initialData} />
    </EntitlementGate>
  )
}
