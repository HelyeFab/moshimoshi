'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import { useFeature } from '@/hooks/useFeature';
import { kanjiService } from '@/services/kanjiService';
import type { JLPTLevel, Kanji } from '@/types/kanji';
// Gamification removed;

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

const FREE_BOOKMARK_LIMIT = 20;
const PAGE_SIZE = 20;
const ALL_LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

function getFreeBookmarkStorageKey(userId: string): string {
  return `kanji_browser_free_bookmarks_${userId}`;
}

function loadFreeBookmarks(userId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getFreeBookmarkStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveFreeBookmarks(userId: string, bookmarkIds: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getFreeBookmarkStorageKey(userId), JSON.stringify(bookmarkIds));
  } catch (error) {
    console.error('Failed to persist free kanji bookmarks locally:', error);
  }
}

function normalizeJlptFilter(jlpt?: string): JLPTLevel[] {
  if (!jlpt) return ALL_LEVELS;

  const normalized = jlpt.toUpperCase();
  if (ALL_LEVELS.includes(normalized as JLPTLevel)) {
    return [normalized as JLPTLevel];
  }

  const numericLevel = normalized.replace(/^N/, '');
  const candidate = `N${numericLevel}` as JLPTLevel;
  return ALL_LEVELS.includes(candidate) ? [candidate] : ALL_LEVELS;
}

function matchesStrokeFilter(strokeCount: number, strokes?: string): boolean {
  if (!strokes) return true;

  if (strokes.endsWith('+')) {
    const minimum = Number.parseInt(strokes.slice(0, -1), 10);
    return Number.isFinite(minimum) ? strokeCount >= minimum : true;
  }

  const [minimumRaw, maximumRaw] = strokes.split('-');
  const minimum = Number.parseInt(minimumRaw || '', 10);
  const maximum = Number.parseInt(maximumRaw || '', 10);

  if (!Number.isFinite(minimum)) return true;
  if (!Number.isFinite(maximum)) return strokeCount >= minimum;
  return strokeCount >= minimum && strokeCount <= maximum;
}

function matchesKanjiFilters(kanji: Kanji, currentFilters: BrowseFilters): boolean {
  if (currentFilters.grade) {
    const targetGrade = currentFilters.grade === 'S'
      ? 'S'
      : Number.parseInt(currentFilters.grade, 10);
    if (kanji.grade !== targetGrade) {
      return false;
    }
  }

  return matchesStrokeFilter(kanji.strokeCount, currentFilters.strokes);
}

function toBrowseKanjiItem(kanji: Kanji, bookmarks: Set<string>): KanjiItem {
  return {
    id: kanji.kanji,
    character: kanji.kanji,
    meanings: kanji.meanings,
    onyomi: kanji.onyomi,
    kunyomi: kanji.kunyomi,
    strokeCount: kanji.strokeCount,
    jlptLevel: Number.parseInt(kanji.jlpt.replace('N', ''), 10),
    grade: typeof kanji.grade === 'number' ? kanji.grade : 0,
    frequency: kanji.frequency,
    bookmarked: bookmarks.has(kanji.kanji),
  };
}

export function useKanjiBrowser() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { showToast } = useToast();
  const { checkOnly } = useFeature('kanji_browser');
  // Gamification removed
  // const achievementStore = useAchievementStore();

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

      const updatedSession = {
        ...session,
        kanjiViewed: [...new Set([...session.kanjiViewed, ...kanjiIds])]
      };
      setSession(updatedSession);
      sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));
    } catch (error) {
      console.error('Failed to track browse event:', error);
    }
  }, [user, session]);

  // Load kanji with filters
  const loadKanji = useCallback(async (pageNum: number = 1, newFilters?: BrowseFilters) => {
    if (!user?.uid) {
      showToast('Please sign in to browse kanji', 'warning');
      return;
    }

    setLoading(true);
    try {
      const currentFilters = newFilters || filters;
      const targetLevels = normalizeJlptFilter(currentFilters.jlpt);
      const searchQuery = currentFilters.search?.trim() || '';

      let filteredKanji: Kanji[];
      if (searchQuery) {
        filteredKanji = await kanjiService.searchKanji(searchQuery, targetLevels);
      } else {
        const levelResults = await Promise.all(
          targetLevels.map(level => kanjiService.loadKanjiByLevel(level))
        );
        filteredKanji = levelResults.flat();
      }

      const filteredItems = filteredKanji
        .filter(kanji => matchesKanjiFilters(kanji, currentFilters))
        .sort((left, right) => {
          const leftFrequency = left.frequency ?? Number.MAX_SAFE_INTEGER;
          const rightFrequency = right.frequency ?? Number.MAX_SAFE_INTEGER;
          if (leftFrequency !== rightFrequency) {
            return leftFrequency - rightFrequency;
          }
          return left.kanji.localeCompare(right.kanji);
        })
        .map(item => toBrowseKanjiItem(item, bookmarks));

      const offset = (pageNum - 1) * PAGE_SIZE;
      const pageItems = filteredItems.slice(offset, offset + PAGE_SIZE);
      const nextHasMore = offset + PAGE_SIZE < filteredItems.length;

      if (pageNum === 1) {
        setKanji(pageItems);
      } else {
        setKanji(prev => [...prev, ...pageItems]);
      }

      setHasMore(nextHasMore);
      setPage(pageNum);

      // Track browse events for loaded kanji
      if (session && pageItems.length > 0) {
        const kanjiIds = pageItems.map(k => k.id);
        trackBrowseEvent(kanjiIds);
      }

    } catch (error) {
      console.error('Failed to load kanji:', error);
      showToast('Failed to load kanji. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, filters, session, showToast, bookmarks, trackBrowseEvent]);

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
      const decision = await checkOnly({ failOpen: false });
      if (!decision.allow) {
        showToast('Daily limit reached for kanji browser.', 'warning');
        return false;
      }

      const response = await fetch('/api/kanji/add-to-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanjiIds })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          showToast('Daily limit reached for kanji browser.', 'warning');
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
      setDailyUsage({
        added: typeof data.dailyUsage === 'number' ? data.dailyUsage : kanjiIds.length,
        limit: data.dailyLimit === 'unlimited' ? -1 : Number(data.dailyLimit ?? 5),
      });

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
  }, [user, session, showToast, checkOnly]);

  // Toggle bookmark
  const toggleBookmark = useCallback(async (kanjiId: string, character: string) => {
    if (!user?.uid) {
      showToast('Please sign in to bookmark kanji', 'warning');
      return;
    }

    const isBookmarked = bookmarks.has(kanjiId);

    try {
      if (!isPremium) {
        const currentLocalBookmarks = loadFreeBookmarks(user.uid);

        if (isBookmarked) {
          const nextBookmarks = currentLocalBookmarks.filter(id => id !== kanjiId);
          saveFreeBookmarks(user.uid, nextBookmarks);
          setBookmarks(new Set(nextBookmarks));
          showToast('Bookmark removed', 'info');
        } else {
          if (currentLocalBookmarks.length >= FREE_BOOKMARK_LIMIT) {
            showToast(
              'Bookmark limit reached! Upgrade to premium for unlimited bookmarks.',
              'warning'
            );
            return;
          }

          const nextBookmarks = [...currentLocalBookmarks, kanjiId];
          saveFreeBookmarks(user.uid, nextBookmarks);
          setBookmarks(new Set(nextBookmarks));
          showToast('Kanji bookmarked!', 'success');

          if (session) {
            const updatedSession = {
              ...session,
              kanjiBookmarked: [...session.kanjiBookmarked, kanjiId]
            };
            setSession(updatedSession);
            sessionStorage.setItem('kanji_browse_session', JSON.stringify(updatedSession));
          }
        }

        setKanji(prev => prev.map(k =>
          k.id === kanjiId ? { ...k, bookmarked: !isBookmarked } : k
        ));
        return;
      }

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
  }, [user, bookmarks, session, showToast, isPremium]);

  // Load bookmarks
  const loadBookmarks = useCallback(async () => {
    if (!user?.uid) return;

    try {
      if (!isPremium) {
        setBookmarks(new Set(loadFreeBookmarks(user.uid)));
        return;
      }

      const response = await fetch('/api/kanji/bookmarks');
      const data = await response.json();

      if (response.ok) {
        setBookmarks(new Set(data.bookmarks.map((b: any) => b.id)));
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  }, [user, isPremium]);

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

  useEffect(() => {
    setKanji(prev => prev.map(item => ({
      ...item,
      bookmarked: bookmarks.has(item.id),
    })));
  }, [bookmarks]);

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
    canAddMore: dailyUsage.limit === -1 || dailyUsage.added < dailyUsage.limit
  };
}
