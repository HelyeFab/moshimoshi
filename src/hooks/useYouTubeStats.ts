import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export interface YouTubeStats {
  videosPracticed: number;      // Total unique videos accessed
  videosRemaining: number;       // Daily quota remaining
  watchTime: number;             // Total practice time in seconds
  quotaLimit: number;            // Daily quota limit
  quotaUsed: number;            // Daily quota used
}

export function useYouTubeStats() {
  const { user, isGuest } = useAuth();
  const [stats, setStats] = useState<YouTubeStats>({
    videosPracticed: 0,
    videosRemaining: 0,
    watchTime: 0,
    quotaLimit: 0,
    quotaUsed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchYouTubeStats = async () => {
      // Guest users have no stats
      if (isGuest || !user) {
        setStats({
          videosPracticed: 0,
          videosRemaining: 0,
          watchTime: 0,
          quotaLimit: 0,
          quotaUsed: 0
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch from /api/youtube/popular which includes quota info
        const response = await fetch('/api/youtube/popular');

        if (!response.ok) {
          throw new Error('Failed to fetch YouTube stats');
        }

        const data = await response.json();

        if (data.success) {
          const { userQuota, stats: apiStats } = data;

          setStats({
            videosPracticed: apiStats?.totalVideos || 0,
            videosRemaining: userQuota?.remaining || 0,
            watchTime: apiStats?.totalPracticeTime || 0,
            quotaLimit: userQuota?.limit || 0,
            quotaUsed: userQuota?.used || 0
          });
        }
      } catch (err) {
        console.error('[useYouTubeStats] Error fetching stats:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchYouTubeStats();
  }, [user, isGuest]);

  return { stats, loading, error };
}
