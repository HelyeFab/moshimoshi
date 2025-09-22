/**
 * Achievement Store
 * Global state management for achievements and gamification using Zustand
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { AchievementSystem, Achievement, UserAchievements } from '@/lib/review-engine/progress/achievement-system'
import { ProgressTracker } from '@/lib/review-engine/progress/progress-tracker'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import logger from '@/lib/logger'
import { achievementManager } from '@/utils/achievementManager'
import { now, nowDate, startOfToday } from '@/lib/time/dateProvider'
import { calculateStreakFromDates, cleanNestedDates } from '@/utils/streakCalculator'

/**
 * Achievement store state interface
 */
interface AchievementState {
  // Core state
  achievements: Achievement[]
  userAchievements: UserAchievements | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  
  // Current user and systems
  currentUserId: string | null
  achievementSystem: AchievementSystem | null
  progressTracker: ProgressTracker | null
  
  // Notification state
  pendingToasts: Achievement[]
  lastNotificationId: string | null
  
  // Streak state
  currentStreak: number
  bestStreak: number
  lastStreakUpdate: Date | null
}

/**
 * Achievement store actions interface
 */
interface AchievementActions {
  // Initialization
  initialize: (userId: string, isPremium?: boolean) => Promise<void>
  reset: () => void
  
  // Achievement operations
  loadAchievements: () => Promise<void>
  unlockAchievement: (achievementId: string) => void
  
  // Progress and streak tracking
  updateProgress: (sessionStats: any) => Promise<void>
  updateStreak: (streak: number) => void
  
  // Notification management
  showAchievementToast: (achievement: Achievement) => void
  dismissToast: (achievementId: string) => void
  clearAllToasts: () => void
  
  // Query operations
  getAchievementById: (id: string) => Achievement | undefined
  getUnlockedAchievements: () => Achievement[]
  getLockedAchievements: () => Achievement[]
  getAchievementsByCategory: (category: string) => Achievement[]
  getRecentAchievements: (limit?: number) => Achievement[]
  getNextAchievable: (limit?: number) => Achievement[]
  
  // Statistics
  getTotalPoints: () => number
  getCompletionPercentage: () => number
  getCategoryStats: () => Map<string, number>
  
  // Error handling
  clearError: () => void
}

/**
 * Combined store type
 */
type AchievementStore = AchievementState & AchievementActions

/**
 * Create the achievement store
 */
export const useAchievementStore = create<AchievementStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        achievements: [],
        userAchievements: null,
        isLoading: false,
        isInitialized: false,
        error: null,
        currentUserId: null,
        achievementSystem: null,
        progressTracker: null,
        pendingToasts: [],
        lastNotificationId: null,
        currentStreak: 0,
        bestStreak: 0,
        lastStreakUpdate: null,
        
        // Initialize store for a user
        initialize: async (userId: string, isPremium: boolean = false) => {
          const state = get()
          logger.achievement('Initialize called', {
            userId,
            isPremium,
            currentState: {
              isInitialized: state.isInitialized,
              currentUserId: state.currentUserId,
              currentStreak: state.currentStreak
            }
          })

          if (state.isInitialized && state.currentUserId === userId) {
            logger.achievement('Already initialized for this user, skipping')
            return
          }

          set({
            isLoading: true,
            error: null,
            currentUserId: userId
          })

          try {
            logger.achievement('Starting initialization...')

            // Load achievements from Firebase/localStorage
            const achievementData = await achievementManager.loadAchievements(userId, isPremium)
            logger.achievement('Loaded achievement data', achievementData)

            const activityData = await achievementManager.loadActivities(userId, isPremium)
            logger.achievement('Loaded activity data', activityData)

            // Migrate old data if exists
            await achievementManager.migrateExistingData(userId)
            // Create progress tracker
            const progressTracker = new ProgressTracker(userId)
            await progressTracker.initialize()
            
            // Create achievement system
            const achievementSystem = new AchievementSystem(userId, progressTracker)
            
            // Set up event listeners
            achievementSystem.on('achievement.unlocked', async (data: any) => {
              // Defer state updates to avoid setState during render
              setTimeout(() => {
                get().showAchievementToast(data.achievement)
                get().loadAchievements() // Refresh achievements
              }, 0)

              // Save to Firebase if premium
              if (isPremium) {
                const updatedAchievements = {
                  unlocked: Array.from(achievementSystem.getUserAchievements().unlocked),
                  totalPoints: achievementSystem.getUserAchievements().totalPoints,
                  totalXp: achievementData.totalXp,
                  currentLevel: achievementData.currentLevel,
                  lessonsCompleted: achievementData.lessonsCompleted,
                  lastUpdated: now(),
                  statistics: achievementSystem.getUserAchievements().statistics
                }
                await achievementManager.saveAchievements(userId, updatedAchievements, isPremium)
              }
            })
            
            achievementSystem.on('notification.show', (data: any) => {
              // Achievement notifications are handled via achievement.unlocked event
            })
            
            progressTracker.on('progress.updated', () => {
              achievementSystem.checkAchievements()
            })
            
            progressTracker.on('milestone.reached', () => {
              achievementSystem.checkAchievements()
            })
            
            // Load initial data
            const achievements = achievementSystem.getAllAchievements()
            const userAchievements = achievementSystem.getUserAchievements()
            
            // Clean any nested data structures
            const cleanDates = cleanNestedDates(activityData)

            // Recalculate streak using centralized function
            const streakResult = calculateStreakFromDates(
              cleanDates,
              activityData.bestStreak || 0
            )

            const currentStreak = streakResult.currentStreak
            const bestStreak = streakResult.bestStreak

            set({
              achievements,
              userAchievements,
              achievementSystem,
              progressTracker,
              currentStreak,
              bestStreak,
              isInitialized: true
            })

            // Save updated streak if recalculated differently
            if (currentStreak !== activityData.currentStreak || bestStreak > activityData.bestStreak) {
              const updatedActivities = {
                ...activityData,
                currentStreak,
                bestStreak,
                lastActivity: now()
              }
              await achievementManager.saveActivities(userId, updatedActivities, isPremium)
            }
            
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to initialize achievements',
              isInitialized: false 
            })
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Reset store
        reset: () => {
          const state = get()
          
          // Cleanup systems
          if (state.achievementSystem) {
            state.achievementSystem.destroy()
          }
          if (state.progressTracker) {
            state.progressTracker.destroy()
          }
          
          set({
            achievements: [],
            userAchievements: null,
            isLoading: false,
            isInitialized: false,
            error: null,
            currentUserId: null,
            achievementSystem: null,
            progressTracker: null,
            pendingToasts: [],
            lastNotificationId: null,
            currentStreak: 0,
            bestStreak: 0,
            lastStreakUpdate: null
          })
        },
        
        // Load achievements
        loadAchievements: async () => {
          const state = get()
          if (!state.achievementSystem) {
            throw new Error('Achievement system not initialized')
          }
          
          set({ isLoading: true, error: null })
          
          try {
            const achievements = state.achievementSystem.getAllAchievements()
            const userAchievements = state.achievementSystem.getUserAchievements()
            
            set({ 
              achievements,
              userAchievements
            })
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'Failed to load achievements' })
            throw error
          } finally {
            set({ isLoading: false })
          }
        },
        
        // Unlock achievement (triggered by achievement system)
        unlockAchievement: (achievementId: string) => {
          const state = get()
          const achievement = state.achievements.find(a => a.id === achievementId)
          
          if (achievement && state.userAchievements) {
            // Update local state optimistically
            const updatedAchievements = state.achievements.map(a => 
              a.id === achievementId 
                ? { ...a, unlockedAt: now() }
                : a
            )
            
            const updatedUserAchievements = {
              ...state.userAchievements,
              unlocked: new Set([...state.userAchievements.unlocked, achievementId]),
              totalPoints: state.userAchievements.totalPoints + achievement.points
            }
            
            set({
              achievements: updatedAchievements,
              userAchievements: updatedUserAchievements
            })
          }
        },
        
        // Update progress (called from review sessions)
        updateProgress: async (sessionStats: any) => {
          const state = get()
          const userId = state.currentUserId

          if (!userId) {
            console.warn('No user ID available for updating progress')
            return
          }

          try {
            // Call server API to update activities - this handles auth and Firebase properly
            const response = await fetch('/api/achievements/update-activity', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sessionType: sessionStats.sessionType,
                itemsReviewed: sessionStats.itemsReviewed || 0,
                accuracy: sessionStats.accuracy || 0,
                duration: sessionStats.duration || 0
              })
            })

            if (!response.ok) {
              console.error('[Achievement] Failed to update activity via API:', response.statusText)
              // Continue with local update as fallback
            } else {
              const data = await response.json()
              logger.achievement('Activity updated via API', { streak: data.currentStreak, best: data.bestStreak, today: data.today })

              // Update local state with server response
              set({
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak,
                lastStreakUpdate: nowDate()
              })

              // Also update local storage for immediate access
              const today = data.today || nowDate().toISOString().split('T')[0]
              const activityData = {
                dates: { [today]: true },
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak,
                lastActivity: now()
              }
              localStorage.setItem(`activities_${userId}`, JSON.stringify(activityData))

              // Check achievements if system is initialized
              const state = get()
              if (state.achievementSystem) {
                setTimeout(() => {
                  state.achievementSystem?.checkAchievements()
                }, 0)
              }

              return // Exit early if API call succeeded
            }

            // Fallback to local update if API failed
            const today = nowDate().toISOString().split('T')[0]
            let isPremium = false

            // Load current activity data
            let activityData = await achievementManager.loadActivities(userId, isPremium)

            // Ensure activityData has proper structure
            if (!activityData.dates) {
              activityData.dates = {}
            }
            if (typeof activityData.currentStreak !== 'number') {
              activityData.currentStreak = 0
            }
            if (typeof activityData.bestStreak !== 'number') {
              activityData.bestStreak = 0
            }

            // Mark today as active
            activityData.dates[today] = true
            activityData.lastActivity = now()

            // Calculate streak using centralized function
            const streakResult = calculateStreakFromDates(
              activityData.dates,
              activityData.bestStreak || 0
            )

            activityData.currentStreak = streakResult.currentStreak
            activityData.bestStreak = streakResult.bestStreak

            // Save updated activity data locally
            localStorage.setItem(`activities_${userId}`, JSON.stringify(activityData))

            // Try to save to Firebase if premium (but don't block on it)
            if (isPremium) {
              achievementManager.saveActivities(userId, activityData, isPremium).catch(err => {
                console.warn('[Achievement] Failed to save to Firebase:', err)
              })
            }

            // Update local state
            set({
              currentStreak: streak,
              bestStreak: activityData.bestStreak,
              lastStreakUpdate: nowDate()
            })

            // Update progress tracker if we have session details
            // For now, just log the session - the progressTracker doesn't have recordSessionCompletion
            if (sessionStats.sessionType) {
              logger.achievement('Session completed', {
                type: sessionStats.sessionType,
                itemsReviewed: sessionStats.itemsReviewed || 0,
                accuracy: sessionStats.accuracy || 0,
                duration: sessionStats.duration || 0,
                streak: streak
              })
            }

            // Check achievements if system is initialized
            if (state.achievementSystem) {
              // Use setTimeout to avoid setState during render
              setTimeout(() => {
                state.achievementSystem.checkAchievements()
              }, 0)
            }

          } catch (error) {
            console.error('Failed to update progress:', error)
            // Don't set error state during render
            setTimeout(() => {
              set({ error: error instanceof Error ? error.message : 'Failed to update progress' })
            }, 0)
          }
        },
        
        // Update streak
        updateStreak: (streak: number) => {
          const state = get()
          const userId = state.currentUserId
          
          if (!userId) return
          
          const currentBest = state.bestStreak
          const newBest = Math.max(currentBest, streak)
          
          set({
            currentStreak: streak,
            bestStreak: newBest,
            lastStreakUpdate: nowDate()
          })
          
          // Save best streak
          if (newBest > currentBest) {
            localStorage.setItem(`bestStreak_${userId}`, newBest.toString())
          }
        },
        
        // Show achievement toast
        showAchievementToast: (achievement: Achievement) => {
          const state = get()
          
          // Avoid duplicate toasts
          if (state.pendingToasts.some(a => a.id === achievement.id)) {
            return
          }
          
          set({
            pendingToasts: [...state.pendingToasts, achievement],
            lastNotificationId: achievement.id
          })
        },
        
        // Dismiss toast
        dismissToast: (achievementId: string) => {
          const state = get()
          set({
            pendingToasts: state.pendingToasts.filter(a => a.id !== achievementId)
          })
        },
        
        // Clear all toasts
        clearAllToasts: () => {
          set({ pendingToasts: [] })
        },
        
        // Get achievement by ID
        getAchievementById: (id: string) => {
          return get().achievements.find(a => a.id === id)
        },
        
        // Get unlocked achievements
        getUnlockedAchievements: () => {
          const state = get()
          if (!state.userAchievements) return []
          
          return state.achievements.filter(a => 
            state.userAchievements!.unlocked.has(a.id)
          )
        },
        
        // Get locked achievements
        getLockedAchievements: () => {
          const state = get()
          if (!state.userAchievements) return state.achievements
          
          return state.achievements.filter(a => 
            !state.userAchievements!.unlocked.has(a.id)
          )
        },
        
        // Get achievements by category
        getAchievementsByCategory: (category: string) => {
          return get().achievements.filter(a => a.category === category)
        },
        
        // Get recent achievements
        getRecentAchievements: (limit: number = 5) => {
          const state = get()
          if (!state.userAchievements) return []
          
          return state.userAchievements.recentUnlocks.slice(0, limit)
        },
        
        // Get next achievable achievements
        getNextAchievable: (limit: number = 5) => {
          const state = get()
          if (!state.achievementSystem) return []
          
          return state.achievementSystem.getNextAchievable(limit)
        },
        
        // Get total points
        getTotalPoints: () => {
          return get().userAchievements?.totalPoints || 0
        },
        
        // Get completion percentage
        getCompletionPercentage: () => {
          const state = get()
          if (!state.userAchievements) return 0
          
          return state.userAchievements.statistics.percentageComplete
        },
        
        // Get category stats
        getCategoryStats: () => {
          const state = get()
          if (!state.userAchievements) return new Map()
          
          return state.userAchievements.statistics.byCategory
        },
        
        // Clear error
        clearError: () => {
          set({ error: null })
        }
      }),
      {
        name: 'achievement-store',
        partialize: (state) => ({
          // Only persist essential data
          currentUserId: state.currentUserId,
          currentStreak: state.currentStreak,
          bestStreak: state.bestStreak,
          lastStreakUpdate: state.lastStreakUpdate
        })
      }
    )
  )
)

// Export types for use in components
export type { Achievement, UserAchievements }