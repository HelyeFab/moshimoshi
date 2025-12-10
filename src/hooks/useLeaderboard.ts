/**
 * useLeaderboard Hook
 * Shared hook for leaderboard data fetching and state management
 * Used by both the leaderboard page and statistics page leaderboard preview
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  UserRankResponse,
  PaginationMetadata
} from '@/lib/leaderboard/types';

interface UseLeaderboardOptions {
  /** Number of entries per page (default: 20) */
  limit?: number;
  /** Initial page to load (default: 1) */
  initialPage?: number;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
  /** Fetch user rank (requires authentication) */
  fetchUserRank?: boolean;
}

interface UseLeaderboardReturn {
  /** Leaderboard entries for current page */
  entries: LeaderboardEntry[];
  /** Pagination metadata */
  pagination: PaginationMetadata | null;
  /** Total players count */
  totalPlayers: number;
  /** Last update timestamp */
  lastUpdated: number | null;
  /** Current user's rank (null if unranked/not in top 100) */
  userRank: number | null;
  /** Current user's entry data */
  userEntry: LeaderboardEntry | undefined;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Current page number */
  page: number;
  /** Set page number */
  setPage: (page: number) => void;
  /** Refresh leaderboard data */
  refresh: () => Promise<void>;
  /** Check if leaderboard feature is enabled */
  isEnabled: boolean;
}

// Feature flag check
const isLeaderboardEnabled = process.env.NEXT_PUBLIC_FEATURE_LEADERBOARD === 'true';

export function useLeaderboard(options: UseLeaderboardOptions = {}): UseLeaderboardReturn {
  const {
    limit = 20,
    initialPage = 1,
    autoFetch = true,
    fetchUserRank = true
  } = options;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMetadata | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async (pageNum: number) => {
    if (!isLeaderboardEnabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leaderboard?page=${pageNum}&limit=${limit}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch leaderboard');
      }

      const data: LeaderboardResponse = await response.json();

      setEntries(data.entries);
      setPagination(data.pagination);
      setTotalPlayers(data.metadata.totalPlayers);
      setLastUpdated(data.metadata.lastUpdated);
    } catch (err) {
      console.error('[useLeaderboard] Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Fetch user rank
  const fetchUserRankData = useCallback(async () => {
    if (!isLeaderboardEnabled || !fetchUserRank) return;

    try {
      const response = await fetch('/api/leaderboard/user-rank');

      if (response.ok) {
        const data: UserRankResponse = await response.json();
        setUserRank(data.rank);
        setUserEntry(data.entry);
        // Update total players if not already set
        if (data.totalPlayers && !totalPlayers) {
          setTotalPlayers(data.totalPlayers);
        }
      } else if (response.status !== 401) {
        // Don't log error for unauthorized (expected when not logged in)
        console.error('[useLeaderboard] Error fetching user rank:', response.status);
      }
    } catch (err) {
      console.error('[useLeaderboard] Error fetching user rank:', err);
    }
  }, [fetchUserRank, totalPlayers]);

  // Combined refresh function
  const refresh = useCallback(async () => {
    await Promise.all([
      fetchLeaderboard(page),
      fetchUserRankData()
    ]);
  }, [fetchLeaderboard, fetchUserRankData, page]);

  // Auto-fetch on mount and page change
  useEffect(() => {
    if (autoFetch && isLeaderboardEnabled) {
      fetchLeaderboard(page);
    }
  }, [autoFetch, fetchLeaderboard, page]);

  // Fetch user rank on mount
  useEffect(() => {
    if (autoFetch && isLeaderboardEnabled && fetchUserRank) {
      fetchUserRankData();
    }
  }, [autoFetch, fetchUserRank, fetchUserRankData]);

  return {
    entries,
    pagination,
    totalPlayers,
    lastUpdated,
    userRank,
    userEntry,
    loading,
    error,
    page,
    setPage,
    refresh,
    isEnabled: isLeaderboardEnabled
  };
}

/**
 * Lightweight hook for leaderboard preview (statistics page)
 * Only fetches top N entries and user rank, no pagination
 */
export function useLeaderboardPreview(topN: number = 5) {
  const {
    entries,
    userRank,
    userEntry,
    totalPlayers,
    loading,
    error,
    isEnabled,
    refresh
  } = useLeaderboard({
    limit: topN,
    initialPage: 1,
    autoFetch: true,
    fetchUserRank: true
  });

  return {
    topEntries: entries.slice(0, topN),
    userRank,
    userEntry,
    totalPlayers,
    loading,
    error,
    isEnabled,
    refresh
  };
}
