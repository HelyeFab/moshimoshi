/**
 * Gamification State Management
 * Zustand store with Firebase-first architecture and optimistic updates
 *
 * Architecture:
 * - Firebase as single source of truth (matches URE pattern)
 * - Optimistic UI updates for instant feedback
 * - Version-based conflict detection
 * - Mutation queue for non-streak operations
 * - Streak operations use dedicated API endpoints with transactions
 *
 * State includes: XP, level, streaks, achievements, session tracking
 * Middleware: Feature flag checks, optimistic updates, hydration tracking
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'
import {
  DateSerializer,
  type ISODateString,
  type ISODateTimeString,
} from '@/lib/types/shared/timestamp.types'
import { VersionConflictError } from '@/lib/types/shared/versioned.types'

// Global flag to prevent duplicate Firebase loads
let isLoadingFromFirebase = false

/**
 * Mutation queue for preventing race conditions
 * Ensures operations are processed sequentially
 */
interface MutationQueue {
  pending: Array<() => Promise<void>>
  isProcessing: boolean
}

const mutationQueue: MutationQueue = {
  pending: [],
  isProcessing: false,
}

/**
 * Process queued mutations sequentially
 * Prevents race conditions from concurrent updates
 */
async function processMutationQueue() {
  if (mutationQueue.isProcessing) return

  mutationQueue.isProcessing = true

  while (mutationQueue.pending.length > 0) {
    const mutation = mutationQueue.pending.shift()!
    try {
      await mutation()
    } catch (error) {
      console.error('[Mutation Queue] Operation failed:', error)
    }
  }

  mutationQueue.isProcessing = false
}

/**
 * Queue a mutation for sequential processing
 */
function queueMutation(mutation: () => Promise<void>) {
  mutationQueue.pending.push(mutation)
  processMutationQueue()
}

interface GamificationState {
  // Core Stats
  totalXP: number
  currentLevel: number // Calculated: Math.max(1, Math.floor(totalXP / 1000))
  currentStreak: number
  bestStreak: number
  lastActivityDate: ISODateString | null // FIXED: Now ISO string instead of Date

  // Achievements
  unlockedAchievements: string[] // Achievement IDs
  achievementProgress: Record<string, number> // For multi-step achievements

  // Session Tracking (needed for achievements)
  sessionCount: number

  // Metadata
  userId: string | null
  lastSyncedAt: ISODateTimeString | null // FIXED: Now ISO string instead of Date
  isDirty: boolean // Has unsaved changes
  isLoaded: boolean // Has data been loaded from Firebase/IndexedDB
  version: number // For conflict detection (both modes now)
  isSyncing: boolean // Currently syncing to Firebase
  hasHydrated: boolean // NEW: Hydration complete flag

  // Actions
  setUserId: (userId: string) => void
  awardXP: (amount: number) => void
  incrementStreak: () => Promise<void>
  resetStreak: () => Promise<void>
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  incrementSessionCount: () => void
  updateFromServer: (data: {
    totalXP: number
    currentLevel: number
    currentStreak: number
    bestStreak: number
  }) => void
  syncToFirebase: () => Promise<void>
  loadFromFirebase: () => Promise<void>
  loadFromIndexedDB: (userId: string) => Promise<void>
  saveToIndexedDB: () => Promise<void>
  reset: () => void
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      totalXP: 0,
      currentLevel: 1,
      currentStreak: 0,
      bestStreak: 0,
      lastActivityDate: null,
      unlockedAchievements: [],
      achievementProgress: {},
      sessionCount: 0,
      userId: null,
      lastSyncedAt: null,
      isDirty: false,
      isLoaded: false,
      version: 1,
      isSyncing: false,
      hasHydrated: false, // NEW

      // Actions

      /**
       * Set the user ID for IndexedDB operations
       */
      setUserId: userId => {
        set({ userId })
      },

      /**
       * Award XP and recalculate level
       * FIXED: Uses mutation queue and ISO date strings
       */
      awardXP: amount => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        const state = get()

        // CRITICAL: Block if not hydrated
        if (!state.hasHydrated) {
          console.error('[Gamification Store] Cannot award XP before hydration complete')
          return
        }

        // Optimistic update
        const newTotalXP = state.totalXP + amount
        const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

        set({
          totalXP: newTotalXP,
          currentLevel: newLevel,
          lastActivityDate: DateSerializer.getCurrentDateUTC(), // FIXED: ISO string
          isDirty: true,
          version: state.version + 1, // FIXED: Always increment version
        })

        // Queue mutation to prevent race conditions
        queueMutation(async () => {
          await get().saveToIndexedDB()

          // Auto-sync if online
          if (typeof window !== 'undefined' && navigator.onLine) {
            await get().syncToFirebase()
          }
        })
      },

      /**
       * Increment streak counter by 1 (on successful daily activity)
       *
       * Firebase-first architecture:
       * - Optimistic UI update for instant feedback
       * - POST to /api/gamification/streak/increment with transaction
       * - Version-based conflict detection
       * - Reverts on failure with IndexedDB fallback
       */
      incrementStreak: async () => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        const state = get()

        // CRITICAL: Block if not hydrated
        if (!state.hasHydrated) {
          console.error('[Gamification Store] Cannot increment streak before hydration complete')
          return
        }

        // Optimistic UI update (instant feedback)
        const optimisticNewStreak = state.currentStreak + 1
        set({
          currentStreak: optimisticNewStreak,
          bestStreak: Math.max(optimisticNewStreak, state.bestStreak),
          lastActivityDate: DateSerializer.getCurrentDateUTC(),
          isSyncing: true,
        })

        try {
          // Get Firebase auth token
          const { getAuth } = await import('firebase/auth')
          const auth = getAuth()
          const user = auth.currentUser

          if (!user) {
            throw new Error('User not authenticated')
          }

          const idToken = await user.getIdToken()

          // Call transactional API endpoint
          const response = await fetch('/api/gamification/streak/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              version: state.version,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to increment streak: ${response.statusText}`)
          }

          const result = await response.json()

          if (result.success && result.data) {
            set({
              currentStreak: result.data.current,
              bestStreak: result.data.best,
              lastActivityDate: result.data.lastActivityDate,
              version: result.data.version,
              isSyncing: false,
              isDirty: false,
            })

            console.log('[Gamification Store] Streak incremented via Firebase:', result.data)
          } else if (result.conflictDetected) {
            // Conflict detected - reload from server
            console.warn('[Gamification Store] Conflict detected, reloading from Firebase')
            await get().loadFromFirebase()
          } else {
            throw new Error('Invalid response from streak increment API')
          }
        } catch (error) {
          console.error('[Gamification Store] Failed to increment streak via Firebase:', error)

          // Revert optimistic update on error
          set({
            currentStreak: state.currentStreak,
            bestStreak: state.bestStreak,
            lastActivityDate: state.lastActivityDate,
            isSyncing: false,
            isDirty: true,
          })

          // Fall back to IndexedDB save
          await get().saveToIndexedDB()
        }
      },

      /**
       * Reset streak to 0 (on missed day without freeze)
       *
       * Firebase-first architecture:
       * - Optimistic UI update
       * - POST to /api/gamification/streak/reset with transaction
       * - Version-based conflict detection
       * - Reverts on failure with IndexedDB fallback
       */
      resetStreak: async () => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        const state = get()

        // CRITICAL: Block if not hydrated
        if (!state.hasHydrated) {
          console.error('[Gamification Store] Cannot reset streak before hydration complete')
          return
        }

        // Optimistic UI update
        set({
          currentStreak: 0,
          lastActivityDate: DateSerializer.getCurrentDateUTC(),
          isSyncing: true,
        })

        try {
          // Get Firebase auth token
          const { getAuth } = await import('firebase/auth')
          const auth = getAuth()
          const user = auth.currentUser

          if (!user) {
            throw new Error('User not authenticated')
          }

          const idToken = await user.getIdToken()

          // Call transactional API endpoint
          const response = await fetch('/api/gamification/streak/reset', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              version: state.version,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to reset streak: ${response.statusText}`)
          }

          const result = await response.json()

          if (result.success && result.data) {
            set({
              currentStreak: result.data.current,
              bestStreak: result.data.best ?? state.bestStreak,
              lastActivityDate: result.data.lastActivityDate,
              version: result.data.version,
              isSyncing: false,
              isDirty: false,
            })

            console.log('[Gamification Store] Streak reset via Firebase:', result.data)
          } else if (result.conflictDetected) {
            // Conflict detected - reload from server
            console.warn('[Gamification Store] Conflict detected, reloading from Firebase')
            await get().loadFromFirebase()
          } else {
            throw new Error('Invalid response from streak reset API')
          }
        } catch (error) {
          console.error('[Gamification Store] Failed to reset streak via Firebase:', error)

          // Revert optimistic update on error
          set({
            currentStreak: state.currentStreak,
            lastActivityDate: state.lastActivityDate,
            isSyncing: false,
            isDirty: true,
          })

          // Fall back to IndexedDB save
          await get().saveToIndexedDB()
        }
      },

      /**
       * Unlock an achievement
       */
      unlockAchievement: id => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        const state = get()

        // CRITICAL: Block if not hydrated
        if (!state.hasHydrated) {
          console.error('[Gamification Store] Cannot unlock achievement before hydration complete')
          return
        }

        set(state => {
          // Prevent duplicate unlocks
          if (state.unlockedAchievements.includes(id)) {
            return state
          }

          return {
            unlockedAchievements: [...state.unlockedAchievements, id],
            version: state.version + 1,
            isDirty: true,
          }
        })

        queueMutation(async () => {
          await get().saveToIndexedDB()
        })
      },

      /**
       * Update achievement progress (for multi-step achievements)
       */
      updateAchievementProgress: (id, progress) => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        const state = get()

        // CRITICAL: Block if not hydrated
        if (!state.hasHydrated) {
          console.error(
            '[Gamification Store] Cannot update achievement progress before hydration complete'
          )
          return
        }

        set(state => ({
          achievementProgress: {
            ...state.achievementProgress,
            [id]: progress,
          },
          version: state.version + 1,
          isDirty: true,
        }))

        queueMutation(async () => {
          await get().saveToIndexedDB()
        })
      },

      /**
       * Increment session count (for achievement tracking and celebration trigger)
       * NOTE: No hydration check here - if server processed the session, we MUST
       * increment the count to trigger CelebrationProvider
       */
      incrementSessionCount: () => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        set(state => ({
          sessionCount: state.sessionCount + 1,
          version: state.version + 1,
          isDirty: true,
        }))

        // Only save to IndexedDB if hydrated (to avoid overwriting real data)
        const state = get()
        if (state.hasHydrated) {
          queueMutation(async () => {
            await get().saveToIndexedDB()
          })
        }
      },

      /**
       * Update store from server response (used by gamificationListener)
       * Updates XP, level, and streak data from API responses
       */
      updateFromServer: data => {
        // Feature flag check
        if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
          return
        }

        set({
          totalXP: data.totalXP,
          currentLevel: data.currentLevel,
          currentStreak: data.currentStreak,
          bestStreak: data.bestStreak,
          isDirty: false,
          lastSyncedAt: DateSerializer.getCurrentDateTimeUTC(),
        })
      },

      /**
       * Sync to Firebase (premium only)
       * FIXED: Uses ISO strings
       */
      syncToFirebase: async () => {
        try {
          // Only run in browser
          if (typeof window === 'undefined') return

          const state = get()

          // Validate userId
          if (!state.userId) {
            console.warn('[Gamification State] No userId set, skipping Firebase sync')
            return
          }

          // CRITICAL: Don't sync if data hasn't been loaded yet (prevents race condition)
          if (!state.isLoaded || !state.hasHydrated) {
            console.warn(
              '[Gamification State] Data not loaded/hydrated yet, skipping Firebase sync to prevent overwriting real data'
            )
            return
          }

          // Don't sync if there are no changes (optimization + safety)
          if (!state.isDirty) {
            return
          }

          // Detect uninitialized data (all zeros) - likely a bug if trying to sync this
          const looksUninitialized =
            state.totalXP === 0 &&
            state.currentStreak === 0 &&
            state.bestStreak === 0 &&
            state.sessionCount === 0 &&
            state.unlockedAchievements.length === 0

          if (looksUninitialized && state.lastSyncedAt === null) {
            console.error(
              '[Gamification State] Refusing to sync uninitialized data (all zeros). This prevents data loss!'
            )
            console.error('[Gamification State] Current state:', {
              totalXP: state.totalXP,
              currentStreak: state.currentStreak,
              sessionCount: state.sessionCount,
              isLoaded: state.isLoaded,
              hasHydrated: state.hasHydrated,
              isDirty: state.isDirty,
            })
            return
          }

          // Call sync API (streak is synced separately via incrementStreak)
          const response = await fetch('/api/gamification/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              totalXP: state.totalXP,
              lastActivityDate: state.lastActivityDate, // Already ISO string
              unlockedAchievements: state.unlockedAchievements,
              achievementProgress: state.achievementProgress,
              sessionCount: state.sessionCount,
            }),
          })

          if (!response.ok) {
            throw new Error(`Firebase sync failed: ${response.statusText}`)
          }

          const result = await response.json()

          set({
            lastSyncedAt: DateSerializer.getCurrentDateTimeUTC(), // FIXED: ISO string
            isDirty: false,
          })
        } catch (error) {
          console.error('[Gamification State] Failed to sync to Firebase:', error)
          // Don't throw - let it retry later
        }
      },

      /**
       * Load state from Firebase (premium users only)
       * Downloads cloud data and caches it to IndexedDB
       * FIXED: Uses ISO strings
       */
      loadFromFirebase: async () => {
        try {
          // Prevent duplicate simultaneous loads
          if (isLoadingFromFirebase) {
            return
          }

          isLoadingFromFirebase = true

          // Only run in browser
          if (typeof window === 'undefined') {
            isLoadingFromFirebase = false
            return
          }

          const state = get()

          // Validate userId
          if (!state.userId) {
            console.warn('[Gamification State] No userId set, skipping Firebase load')
            isLoadingFromFirebase = false
            return
          }

          // Call load API
          const response = await fetch('/api/gamification/load', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })

          if (!response.ok) {
            throw new Error(`Firebase load failed: ${response.statusText}`)
          }

          const result = await response.json()

          if (result.success && result.data) {
            const data = result.data
            const streak = data.streak || {
              current: 0,
              best: 0,
              lastActivityDate: null,
              version: 1,
            }

            set({
              totalXP: data.totalXP,
              currentLevel: Math.max(1, Math.floor(data.totalXP / 1000)),
              currentStreak: streak.current ?? 0,
              bestStreak: streak.best ?? 0,
              lastActivityDate: streak.lastActivityDate, // Already ISO string
              unlockedAchievements: data.unlockedAchievements || [],
              achievementProgress: data.achievementProgress || {},
              sessionCount: data.sessionCount || 0,
              version: streak.version ?? 1,
              isDirty: false,
              isLoaded: true,
              hasHydrated: true, // Mark as hydrated
              lastSyncedAt: DateSerializer.getCurrentDateTimeUTC(),
            })

            await get().saveToIndexedDB()
          } else {
            // Mark as loaded even if no data found (prevents sync race condition)
            set({ isLoaded: true, hasHydrated: true })
          }
        } catch (error) {
          console.error('[Gamification State] Failed to load from Firebase:', error)
          // Don't throw - allow fallback to IndexedDB
          set({ hasHydrated: true }) // Still mark as hydrated to allow app to work
        } finally {
          isLoadingFromFirebase = false
        }
      },

      /**
       * Load state from IndexedDB
       * FIXED: Uses ISO strings
       */
      loadFromIndexedDB: async userId => {
        try {
          // Only run in browser
          if (typeof window === 'undefined') return

          // Validate userId
          if (!userId) {
            console.warn('[Gamification State] No userId provided to loadFromIndexedDB')
            return
          }

          // Store userId for future saves
          set({ userId })

          const data = await indexedDBStore.load(userId)

          if (data) {
            set({
              totalXP: data.totalXP,
              // Recalculate level from XP
              currentLevel: Math.max(1, Math.floor(data.totalXP / 1000)),
              currentStreak: data.currentStreak,
              bestStreak: data.bestStreak,
              lastActivityDate: data.lastActivityDate, // Already ISO string
              unlockedAchievements: data.unlockedAchievements,
              achievementProgress: data.achievementProgress,
              sessionCount: data.sessionCount || 0,
              version: data.version || 1,
              isDirty: false,
              isLoaded: true,
              hasHydrated: true, // Mark as hydrated
            })
          } else {
            // Mark as loaded even if no data found (prevents sync race condition)
            set({ isLoaded: true, hasHydrated: true })
          }
        } catch (error) {
          console.error('[Gamification State] Failed to load from IndexedDB:', error)
          set({ hasHydrated: true }) // Still mark as hydrated to allow app to work
        }
      },

      /**
       * Save current state to IndexedDB
       * FIXED: Uses ISO strings
       */
      saveToIndexedDB: async () => {
        try {
          // Only run in browser
          if (typeof window === 'undefined') return

          const state = get()

          // Validate userId
          if (!state.userId) {
            console.warn('[Gamification State] No userId set, skipping IndexedDB save')
            return
          }

          await indexedDBStore.save(state.userId, {
            userId: state.userId,
            totalXP: state.totalXP,
            currentStreak: state.currentStreak,
            bestStreak: state.bestStreak,
            lastActivityDate: state.lastActivityDate, // Already ISO string
            unlockedAchievements: state.unlockedAchievements,
            achievementProgress: state.achievementProgress,
            sessionCount: state.sessionCount,
            lastSyncedAt: state.lastSyncedAt, // Already ISO string
            version: state.version ?? 1,
          })
        } catch (error) {
          console.error('[Gamification State] Failed to save to IndexedDB:', error)
        }
      },

      /**
       * Reset state to initial values
       */
      reset: () => {
        set({
          totalXP: 0,
          currentLevel: 1,
          currentStreak: 0,
          bestStreak: 0,
          lastActivityDate: null,
          unlockedAchievements: [],
          achievementProgress: {},
          sessionCount: 0,
          lastSyncedAt: null,
          isDirty: false,
          isLoaded: false,
          hasHydrated: false,
          version: 1,
        })
      },
    }),
    {
      name: 'gamification-storage',
      storage: createJSONStorage(() => ({
        getItem: async name => {
          const userId = useGamificationStore.getState().userId
          if (!userId) return null

          const data = await indexedDBStore.load(userId)
          return data ? JSON.stringify(data) : null
        },
        setItem: async (name, value) => {
          const state = JSON.parse(value)
          if (state.userId) {
            await indexedDBStore.save(state.userId, state)
          }
        },
        removeItem: async name => {
          const userId = useGamificationStore.getState().userId
          if (userId) {
            await indexedDBStore.clear(userId)
          }
        },
      })),
      onRehydrateStorage: () => state => {
        // Mark as hydrated when rehydration completes
        if (state) {
          state.hasHydrated = true
        }
      },
    }
  )
)
