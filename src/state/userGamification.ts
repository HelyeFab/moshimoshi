/**
 * Gamification State Management
 * Zustand store with IndexedDB persistence and feature flag enforcement
 *
 * State includes: XP, level, streaks, achievements, session tracking
 * Middleware: Feature flag checks, auto-save to IndexedDB
 */

import { create } from 'zustand'
import { indexedDBStore } from '@/lib/gamification/indexedDBStore'

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

  // Actions
  setUserId: (userId: string) => void
  awardXP: (amount: number) => void
  incrementStreak: () => void
  resetStreak: () => void
  unlockAchievement: (id: string) => void
  updateAchievementProgress: (id: string, progress: number) => void
  incrementSessionCount: () => void
  syncToFirebase: () => Promise<void>
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
   */
  incrementStreak: () => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

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
   */
  resetStreak: () => {
    // Feature flag check
    if (process.env.NEXT_PUBLIC_ENABLE_GAMIFICATION !== 'true') {
      return
    }

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
   * Sync to Firebase (premium only) - TODO: Implement
   */
  syncToFirebase: async () => {
    // TODO: Implement Firebase sync for premium users
    // For now, just mark as synced
    set({ lastSyncedAt: new Date(), isDirty: false })
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
          isDirty: false
        })
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
      isDirty: false
    })
  }
}))
