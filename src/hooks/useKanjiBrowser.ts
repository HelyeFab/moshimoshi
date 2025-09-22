'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useAchievementStore } from '@/stores/achievement-store';

interface KanjiItem {
  id: string;
  character: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  strokeCount: number;
  jlptLevel: number;
  grade: number;
  frequency?: number;
  progress?: any;
  bookmarked: boolean;
}

interface BrowseFilters {
  jlpt?: string;
  grade?: string;
  strokes?: string;
  search?: string;
}

interface BrowseSession {
  id: string;
  startedAt: Date;
  kanjiViewed: string[];
  kanjiBookmarked: string[];
  kanjiAddedToReview: string[];
}

export function useKanjiBrowser() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { showToast } = useToast();
  const achievementStore = useAchievementStore();

  const [session, setSession] = useState<BrowseSession | null>(null);
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [dailyUsage, setDailyUsage] = useState({ added: 0, limit: 5 });

  // Initialize browse session
  const startBrowsing = useCallback(() => {
    const newSession: BrowseSession = {
      id: Math.random().toString(36).substring(7),
      startedAt: new Date(),
      kanjiViewed: [],
      kanjiBookmarked: [],
      kanjiAddedToReview: []
    };
    setSession(newSession);

    // Store session in sessionStorage for recovery
    sessionStorage.setItem('kanji_browse_session', JSON.stringify(newSession));
  }, []);

  // Load kanji with filters
  const loadKanji = useCallback(async (pageNum: number = 1, newFilters?: BrowseFilters) => {
    if (!user?.uid) {
      showToast('Please sign in to browse kanji', 'warning');
      return;
    }

    setLoading(true);
    try {
      const currentFilters = newFilters || filters;
      const params = new URLSearchParams();

      if (currentFilters.jlpt) params.append('jlpt', currentFilters.jlpt);
      if (currentFilters.grade) params.append('grade', currentFilters.grade);
      if (currentFilters.strokes) params.append('strokes', currentFilters.strokes);
      if (currentFilters.search) params.append('q', currentFilters.search);
      params.append('page', pageNum.toString());
      params.append('size', '20');

      const response = await fetch(`/api/kanji/browse?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load kanji');
      }

      if (pageNum === 1) {
        setKanji(data.items);
      } else {
        setKanji(prev => [...prev, ...data.items]);
      }

      setHasMore(data.hasMore);
      setPage(pageNum);

      // Track browse events for loaded kanji
      if (session && data.items.length > 0) {
        const kanjiIds = data.items.map((k: KanjiItem) => k.id);
        trackBrowseEvent(kanjiIds);
      }

    } catch (error) {
      console.error('Failed to load kanji:', error);
      showToast('Failed to load kanji. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, filters, session, showToast]);

  // Track browse events
  const trackBrowseEvent = useCallback(async (kanjiIds: string[]) => {
    if (!user?.uid || !session) return;

    try {
      await fetch('/api/kanji/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kanjiIds,
          action: 'browse',
          sessionId: session.id,
          source: 'browse',
          deviceType: 'desktop'
        })
      });

      // Update session
      const updatedSession = {
        ...session,
        kanjiViewed: [...new Set([...session.kanjiViewed, ...kanjiIds])]
      };
      setSession(updatedSession);
      sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));

      // Update achievement progress (browsing counts for streak)
      if (kanjiIds.length >= 5) {
        await achievementStore.updateProgress({
          sessionType: 'browse',
          itemsBrowsed: kanjiIds.length
        });
      }

    } catch (error) {
      console.error('Failed to track browse event:', error);
    }
  }, [user, session, achievementStore]);

  // Browse a specific kanji (detailed view)
  const browseKanji = useCallback(async (kanjiId: string, character?: string) => {
    if (!session) return;

    try {
      await fetch('/api/kanji/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kanjiIds: [kanjiId],
          character: character || kanjiId,
          action: 'browse',
          sessionId: session.id,
          source: 'browse',
          deviceType: 'desktop'
        })
      });

      // Update session locally
      const updatedSession = {
        ...session,
        kanjiViewed: [...new Set([...session.kanjiViewed, kanjiId])]
      };
      setSession(updatedSession);
      sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));

    } catch (error) {
      console.error('Failed to track browse event:', error);
    }
  }, [session]);

  // Add kanji to review queue
  const addToReview = useCallback(async (kanjiIds: string[]) => {
    if (!user?.uid) {
      showToast('Please sign in to add kanji to review', 'warning');
      return false;
    }

    try {
      const response = await fetch('/api/kanji/add-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanjiIds })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showToast(
            `Daily limit reached! You can add ${data.remaining} more kanji today.`,
            'warning'
          );
        } else {
          throw new Error(data.error);
        }
        return false;
      }

      showToast(
        `Added ${kanjiIds.length} kanji to review queue. ${data.remaining}/${data.dailyLimit} remaining today.`,
        'success'
      );

      // Update daily usage
      setDailyUsage({ added: data.dailyUsage, limit: data.dailyLimit });

      // Update session
      if (session) {
        const updatedSession = {
          ...session,
          kanjiAddedToReview: [...session.kanjiAddedToReview, ...kanjiIds]
        };
        setSession(updatedSession);
        sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));
      }

      return true;

    } catch (error) {
      console.error('Failed to add to review:', error);
      showToast('Failed to add kanji to review queue', 'error');
      return false;
    }
  }, [user, session, showToast]);

  // Toggle bookmark
  const toggleBookmark = useCallback(async (kanjiId: string, character: string) => {
    if (!user?.uid) {
      showToast('Please sign in to bookmark kanji', 'warning');
      return;
    }

    const isBookmarked = bookmarks.has(kanjiId);

    try {
      if (isBookmarked) {
        // Remove bookmark
        const response = await fetch(`/api/kanji/bookmarks?kanjiId=${kanjiId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error('Failed to remove bookmark');
        }

        setBookmarks(prev => {
          const next = new Set(prev);
          next.delete(kanjiId);
          return next;
        });

        showToast('Bookmark removed', 'info');

      } else {
        // Add bookmark
        const response = await fetch('/api/kanji/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kanjiId, character })
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 429) {
            showToast(
              'Bookmark limit reached! Upgrade to premium for unlimited bookmarks.',
              'warning'
            );
          } else {
            throw new Error(data.error);
          }
          return;
        }

        setBookmarks(prev => new Set([...prev, kanjiId]));
        showToast('Kanji bookmarked!', 'success');

        // Update session
        if (session) {
          const updatedSession = {
            ...session,
            kanjiBookmarked: [...session.kanjiBookmarked, kanjiId]
          };
          setSession(updatedSession);
          sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));
        }
      }

      // Update kanji list
      setKanji(prev => prev.map(k =>
        k.id === kanjiId ? { ...k, bookmarked: !isBookmarked } : k
      ));

    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      showToast('Failed to update bookmark', 'error');
    }
  }, [user, bookmarks, session, showToast]);

  // Load bookmarks
  const loadBookmarks = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const response = await fetch('/api/kanji/bookmarks');
      const data = await response.json();

      if (response.ok) {
        setBookmarks(new Set(data.bookmarks.map((b: any) => b.id)));
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }, [user]);

  // Apply filters
  const applyFilters = useCallback((newFilters: BrowseFilters) => {
    setFilters(newFilters);
    setPage(1);
    loadKanji(1, newFilters);
  }, [loadKanji]);

  // Load more (infinite scroll)
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadKanji(page + 1);
    }
  }, [loading, hasMore, page, loadKanji]);

  // Get browse statistics
  const getBrowseStats = useCallback(() => {
    if (!session) {
      return {
        kanjiViewed: 0,
        kanjiBookmarked: 0,
        kanjiAddedToReview: 0,
        sessionDuration: 0
      };
    }

    const now = new Date();
    const duration = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000);

    return {
      kanjiViewed: session.kanjiViewed.length,
      kanjiBookmarked: session.kanjiBookmarked.length,
      kanjiAddedToReview: session.kanjiAddedToReview.length,
      sessionDuration: duration
    };
  }, [session]);

  // Initialize on mount
  useEffect(() => {
    if (user?.uid) {
      // Try to restore session from storage
      const storedSession = sessionStorage.getItem('kanji_browse_session');
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        parsed.startedAt = new Date(parsed.startedAt);
        setSession(parsed);
      } else {
        startBrowsing();
      }

      loadBookmarks();
      // Don't auto-load kanji - let the page handle that with its own kanjiService
      // loadKanji(1);
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Save session stats if significant activity
      const stats = getBrowseStats();
      if (stats.kanjiViewed > 0) {
        console.log('Browse session ended:', stats);
      }
    };
  }, [getBrowseStats]);

  return {
    // State
    session,
    kanji,
    bookmarks,
    filters,
    loading,
    hasMore,
    dailyUsage,

    // Actions
    startBrowsing,
    browseKanji,
    applyFilters,
    addToReview,
    toggleBookmark,
    loadMore,
    getBrowseStats,

    // Computed
    isPremium,
    canAddMore: dailyUsage.added < dailyUsage.limit
  };
}