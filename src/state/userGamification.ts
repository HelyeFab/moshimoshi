/**
 * Gamification State Management
 * Zustand store with Firebase-first architecture and optimistic updates
 *
 * Architecture:
 * - Firebase as single source of truth (matches URE pattern)
 * - Optimistic UI updates for instant feedback
 * - Background sync with automatic retry
 * - Version-based conflict detection
 *
 * State includes: XP, level, streaks, achievements, session tracking
 * Middleware: Feature flag checks, optimistic updates
 */

import { create } from 'zustand'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'

// Global flag to prevent duplicate Firebase loads
let isLoadingFromFirebase = false
// Global flag for feature flag check
let useFirebaseFirst = false

// Check feature flag on load (client-side only)
if (typeof window !== 'undefined') {
  useFirebaseFirst = process.env.NEXT_PUBLIC_STREAK_FIREBASE_FIRST === 'true'
}

interface GamificationState {
  // Core Stats
  totalXP: number
  currentLevel: number // Calculated: Math.max(1, Math.floor(totalXP / 1000))
  currentStreak: number
  bestStreak: number
  lastActivityDate: Date | null

  // Achievements
  unlockedAchievements: string[] // Achievement IDs
  achievementProgress: Record<string, number> // For multi-step achievements

  // Session Tracking (needed for achievements)
  sessionCount: number

  // Metadata
  userId: string | null
  lastSyncedAt: Date | null
  isDirty: boolean // Has unsaved changes
  isLoaded: boolean // Has data been loaded from Firebase/IndexedDB
  version: number // For conflict detection (Firebase-first mode)
  isSyncing: boolean // Currently syncing to Firebase

  // Actions
  setUserId: (userId: string) => void
  awardXP: (amount: number) => void
  incrementStreak: () => void
  resetStreak: () => void
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  incrementSessionCount: () => void
  syncToFirebase: () => Promise<void>
  loadFromFirebase: () => Promise<void>
  loadFromIndexedDB: (userId: string) => Promise<void>
  saveToIndexedDB: () => Promise<void>
  reset: () => void
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
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

  // Actions

  /**
   * Set the user ID for IndexedDB operations
   */
  setUserId: (userId) => {
    set({ userId })
  },

  /**
   * Award XP and recalculate level
   */
  awardXP: (amount) => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    set((state) => {
      const newTotalXP = state.totalXP + amount
      // Level formula: Math.max(1, Math.floor(totalXP / 1000))
      const newLevel = Math.max(1, Math.floor(newTotalXP / 1000))

      return {
        totalXP: newTotalXP,
        currentLevel: newLevel,
        lastActivityDate: new Date(),
        isDirty: true
      }
    })

    // Auto-save to IndexedDB
    get().saveToIndexedDB()
  },

  /**
   * Increment streak counter
   *
   * Firebase-first mode (new):
   * - Optimistic UI update (instant feedback)
   * - Background Firebase transaction
   * - Conflict detection and resolution
   *
   * Legacy mode (old):
   * - Update Zustand + IndexedDB
   * - Manual sync required
   */
  incrementStreak: async () => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    const state = get()

    // Firebase-first mode (feature flag gated)
    if (useFirebaseFirst) {
      // Optimistic UI update (instant feedback)
      const optimisticNewStreak = state.currentStreak + 1
      set({
        currentStreak: optimisticNewStreak,
        bestStreak: Math.max(optimisticNewStreak, state.bestStreak),
        lastActivityDate: new Date(),
        isSyncing: true
      })

      try {
        // Get Firebase auth token
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          throw new Error('User not authenticated');
        }

        const idToken = await user.getIdToken();

        // Call new transactional API endpoint
        const response = await fetch('/api/gamification/streak/increment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            version: state.version
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to increment streak: ${response.statusText}`)
        }

        const result = await response.json()

        if (result.success && result.data) {
          // Update with server data (may differ if conflict resolved)
          set({
            currentStreak: result.data.currentStreak,
            bestStreak: result.data.bestStreak,
            lastActivityDate: result.data.lastActivityDate ? new Date(result.data.lastActivityDate) : new Date(),
            version: result.data.version,
            isSyncing: false,
            isDirty: false
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
          isDirty: true
        })

        // Fall back to IndexedDB save
        get().saveToIndexedDB()
      }

      return
    }

    // Legacy mode (old behavior)
    set((state) => {
      const newStreak = state.currentStreak + 1
      return {
        currentStreak: newStreak,
        bestStreak: Math.max(newStreak, state.bestStreak),
        lastActivityDate: new Date(),
        isDirty: true
      }
    })

    get().saveToIndexedDB()
  },

  /**
   * Reset streak to 0 (on missed day)
   *
   * Firebase-first mode (new):
   * - Optimistic UI update
   * - Background Firebase transaction
   *
   * Legacy mode (old):
   * - Update Zustand + IndexedDB
   */
  resetStreak: async () => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    const state = get()

    // Firebase-first mode (feature flag gated)
    if (useFirebaseFirst) {
      // Optimistic UI update
      set({
        currentStreak: 0,
        lastActivityDate: new Date(),
        isSyncing: true
      })

      try {
        // Get Firebase auth token
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          throw new Error('User not authenticated');
        }

        const idToken = await user.getIdToken();

        // Call new transactional API endpoint
        const response = await fetch('/api/gamification/streak/reset', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            version: state.version
          })
        })

        if (!response.ok) {
          throw new Error(`Failed to reset streak: ${response.statusText}`)
        }

        const result = await response.json()

        if (result.success && result.data) {
          // Update with server data
          set({
            currentStreak: result.data.currentStreak,
            lastActivityDate: result.data.lastActivityDate ? new Date(result.data.lastActivityDate) : new Date(),
            version: result.data.version,
            isSyncing: false,
            isDirty: false
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
          isDirty: true
        })

        // Fall back to IndexedDB save
        get().saveToIndexedDB()
      }

      return
    }

    // Legacy mode (old behavior)
    set({
      currentStreak: 0,
      isDirty: true
    })

    get().saveToIndexedDB()
  },

  /**
   * Unlock an achievement
   */
  unlockAchievement: (id) => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    set((state) => {
      // Prevent duplicate unlocks
      if (state.unlockedAchievements.includes(id)) {
        return state
      }

      return {
        unlockedAchievements: [...state.unlockedAchievements, id],
        isDirty: true
      }
    })

    get().saveToIndexedDB()
  },

  /**
   * Update achievement progress (for multi-step achievements)
   */
  updateAchievementProgress: (id, progress) => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    set((state) => ({
      achievementProgress: {
        ...state.achievementProgress,
        [id]: progress
      },
      isDirty: true
    }))

    get().saveToIndexedDB()
  },

  /**
   * Increment session count (for achievement tracking)
   */
  incrementSessionCount: () => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

    set((state) => ({
      sessionCount: state.sessionCount + 1,
      isDirty: true
    }))

    get().saveToIndexedDB()
  },

  /**
   * Sync to Firebase (premium only)
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
      if (!state.isLoaded) {
        console.warn('[Gamification State] Data not loaded yet, skipping Firebase sync to prevent overwriting real data')
        return
      }

      // Don't sync if there are no changes (optimization + safety)
      if (!state.isDirty) {
        console.log('[Gamification State] No changes to sync, skipping Firebase upload')
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
        console.error('[Gamification State] Refusing to sync uninitialized data (all zeros). This prevents data loss!')
        console.error('[Gamification State] Current state:', {
          totalXP: state.totalXP,
          currentStreak: state.currentStreak,
          sessionCount: state.sessionCount,
          isLoaded: state.isLoaded,
          isDirty: state.isDirty
        })
        return
      }

      // Call sync API
      const response = await fetch('/api/gamification/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalXP: state.totalXP,
          currentStreak: state.currentStreak,
          bestStreak: state.bestStreak,
          lastActivityDate: state.lastActivityDate?.toISOString() || null,
          unlockedAchievements: state.unlockedAchievements,
          achievementProgress: state.achievementProgress,
          sessionCount: state.sessionCount
        })
      })

      if (!response.ok) {
        throw new Error(`Firebase sync failed: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[Gamification State] Synced to Firebase:', result)

      set({ lastSyncedAt: new Date(), isDirty: false })
    } catch (error) {
      console.error('[Gamification State] Failed to sync to Firebase:', error)
      // Don't throw - let it retry later
    }
  },

  /**
   * Load state from Firebase (premium users only)
   * Downloads cloud data and caches it to IndexedDB
   */
  loadFromFirebase: async () => {
    try {
      // Prevent duplicate simultaneous loads
      if (isLoadingFromFirebase) {
        console.log('[Gamification State] Already loading from Firebase, skipping duplicate call')
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

      console.log('[Gamification State] Loading from Firebase for user:', state.userId)

      // Call load API
      const response = await fetch('/api/gamification/load', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        throw new Error(`Firebase load failed: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        const data = result.data

        // Update Zustand state with Firebase data
        set({
          totalXP: data.totalXP,
          // Recalculate level from XP
          currentLevel: Math.max(1, Math.floor(data.totalXP / 1000)),
          currentStreak: data.currentStreak,
          bestStreak: data.bestStreak,
          lastActivityDate: data.lastActivityDate ? new Date(data.lastActivityDate) : null,
          unlockedAchievements: data.unlockedAchievements || [],
          achievementProgress: data.achievementProgress || {},
          sessionCount: data.sessionCount || 0,
          version: data.version || 1, // Include version for conflict detection
          isDirty: false,
          isLoaded: true,
          lastSyncedAt: new Date()
        })

        // Cache Firebase data to IndexedDB for offline access
        await get().saveToIndexedDB()

        console.log('[Gamification State] Loaded from Firebase and cached to IndexedDB:', {
          totalXP: data.totalXP,
          currentStreak: data.currentStreak,
          sessionCount: data.sessionCount
        })
      } else {
        console.log('[Gamification State] No Firebase data found, will use IndexedDB or defaults')
        // Mark as loaded even if no data found (prevents sync race condition)
        set({ isLoaded: true })
      }
    } catch (error) {
      console.error('[Gamification State] Failed to load from Firebase:', error)
      // Don't throw - allow fallback to IndexedDB
    } finally {
      isLoadingFromFirebase = false
    }
  },

  /**
   * Load state from IndexedDB
   */
  loadFromIndexedDB: async (userId) => {
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
          lastActivityDate: data.lastActivityDate ? new Date(data.lastActivityDate) : null,
          unlockedAchievements: data.unlockedAchievements,
          achievementProgress: data.achievementProgress,
          sessionCount: data.sessionCount || 0,
          isDirty: false,
          isLoaded: true
        })
      } else {
        // Mark as loaded even if no data found (prevents sync race condition)
        set({ isLoaded: true })
      }
    } catch (error) {
      console.error('[Gamification State] Failed to load from IndexedDB:', error)
    }
  },

  /**
   * Save current state to IndexedDB
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
        lastActivityDate: state.lastActivityDate?.toISOString() || null,
        unlockedAchievements: state.unlockedAchievements,
        achievementProgress: state.achievementProgress,
        sessionCount: state.sessionCount,
        lastSyncedAt: state.lastSyncedAt?.toISOString() || null,
        version: 1
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
      isLoaded: false
    })
  }
}))
