/**
 * Leaderboard Type Definitions
 * Shared types for leaderboard functionality across client and server
 */

export type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'allTime';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  photoURL?: string;
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  bestStreak: number;
  achievementCount: number;
  lastActive: string | null;
  subscription: 'free' | 'premium_monthly' | 'premium_yearly';
}

export interface LeaderboardSnapshot {
  timeframe: TimeFrame;
  timestamp: number;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdated: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  pagination: PaginationMetadata;
  metadata: {
    totalPlayers: number;
    lastUpdated: number;
  };
}

export interface UserRankResponse {
  rank: number;
  totalPlayers: number;
  entry?: LeaderboardEntry;
}
