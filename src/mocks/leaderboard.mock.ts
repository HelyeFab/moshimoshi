/**
 * Mock Leaderboard Data
 * Static data for the leaderboard page after gamification removal
 */

export interface MockLeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  photoURL?: string
  score: number
  streak: number
  level: number
  isCurrentUser?: boolean
}

// Generate 50 mock leaderboard entries
export const MOCK_LEADERBOARD: MockLeaderboardEntry[] = Array.from({ length: 50 }).map((_, i) => ({
  rank: i + 1,
  userId: `user_${i + 1}`,
  displayName: `User ${i + 1}`,
  photoURL: undefined,
  score: 0,
  streak: 0,
  level: 0,
}))

// Mock current user stats
export const MOCK_CURRENT_USER_STATS = {
  rank: 15,
  score: 0,
  streak: 0,
  level: 0,
}

// Helper functions
export function getMockLeaderboard(limit: number = 50): MockLeaderboardEntry[] {
  return MOCK_LEADERBOARD.slice(0, limit)
}

export function getMockUserRank(userId: string): MockLeaderboardEntry | null {
  return MOCK_LEADERBOARD.find(entry => entry.userId === userId) || null
}

export function getMockTopN(n: number): MockLeaderboardEntry[] {
  return MOCK_LEADERBOARD.slice(0, n)
}
