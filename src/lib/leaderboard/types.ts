/**
 * Leaderboard Types
 * Defines the data structures for the leaderboard system
 */

export type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'allTime'

export interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  photoURL?: string
  username?: string // Optional username/handle

  // Core stats
  totalPoints: number      // From achievements
  totalXP: number         // From XP system
  currentLevel: number    // From XP system
  currentStreak: number   // From streak tracking
  bestStreak: number      // Historical best streak

  // Achievement breakdown
  achievementCount: number
  achievementRarity: {
    legendary: number
    epic: number
    rare: number
    uncommon: number
    common: number
  }

  // Metadata
  lastActive: number      // Unix timestamp
  joinedDate?: number     // Unix timestamp
  subscription?: 'free' | 'premium_monthly' | 'premium_yearly'

  // UI helpers
  isCurrentUser?: boolean
  change?: 'up' | 'down' | 'same' // Position change from last period
  changeAmount?: number   // How many positions changed

  // Privacy
  isPublic: boolean       // Whether user allows public display
  isAnonymous?: boolean   // Show as "Anonymous Learner"
}

export interface LeaderboardSnapshot {
  id: string
  timeframe: TimeFrame
  timestamp: number
  entries: LeaderboardEntry[]
  totalPlayers: number
  lastUpdated: number
}

export interface LeaderboardFilters {
  timeframe: TimeFrame
  limit?: number
  offset?: number
  includeCurrentUser?: boolean
  onlyFriends?: boolean // Future feature
  country?: string      // Future feature
}

export interface UserLeaderboardStats {
  userId: string
  globalRank: number
  percentile: number    // e.g., "Top 5%"
  rankChange: number    // Change from last period
  timeframeRanks: {
    daily: number | null
    weekly: number | null
    monthly: number | null
    allTime: number
  }
  nextMilestone: {
    rank: number
    pointsNeeded: number
    label: string // e.g., "Top 100", "Top 10"
  }
}

export interface LeaderboardAggregationData {
  userId: string
  displayName: string
  photoURL?: string

  // From users/{uid}/achievements/activities
  currentStreak: number
  bestStreak: number
  lastActivity: number

  // From users/{uid}/stats/xp
  totalXP: number
  currentLevel: number
  weeklyXP?: number
  monthlyXP?: number

  // From users/{uid}/achievements/data
  achievementsUnlocked: Record<string, any>
  totalPoints: number

  // From users/{uid} main doc
  subscription?: {
    plan: string
    status: string
  }

  // From users/{uid}/preferences
  privacy?: {
    publicProfile?: boolean
    hideFromLeaderboard?: boolean  // Opt-out model - users are shown by default
    useAnonymousName?: boolean
  }
}

// Achievement rarity levels for categorization
export const ACHIEVEMENT_RARITY = {
  LEGENDARY: 'legendary',
  EPIC: 'epic',
  RARE: 'rare',
  UNCOMMON: 'uncommon',
  COMMON: 'common'
} as const

export type AchievementRarity = typeof ACHIEVEMENT_RARITY[keyof typeof ACHIEVEMENT_RARITY]

// Sorting options for leaderboard
export interface LeaderboardSortOptions {
  primary: 'points' | 'xp' | 'streak' | 'achievements'
  direction: 'desc' | 'asc'
}

// Cache configuration
export interface LeaderboardCacheConfig {
  ttl: number           // Time to live in seconds
  key: string          // Redis key prefix
  maxEntries: number   // Maximum entries to cache
}