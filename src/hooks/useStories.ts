import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  documentId
} from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { Story, StoryProgress, JLPTLevel } from '@/types/story';
import type { CachedStory } from '@/lib/stories/story-cache.types';
import { useAuth } from '@/hooks/useAuth';
import { getStoryCacheManager } from '@/lib/stories/StoryCacheManager';

export function useStories() {
  const { user } = useAuth();
  const cacheManager = getStoryCacheManager();
  const offlineLimit = 2;
  const [stories, setStories] = useState<Story[]>([]);
  const [userProgress, setUserProgress] = useState<Map<string, StoryProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    jlptLevel: 'all' as 'all' | JLPTLevel,
    theme: 'all',
    sortBy: 'newest' as 'newest' | 'popular' | 'progress',
    searchTerm: ''
  });

  const normalizeCachedStory = (cached: CachedStory): Story => ({
    ...cached,
    createdAt: new Date(cached.createdAt),
    updatedAt: new Date(cached.updatedAt),
    publishedAt: cached.publishedAt ? new Date(cached.publishedAt) : undefined,
    audioGeneratedAt: cached.audioGeneratedAt ? new Date(cached.audioGeneratedAt) : undefined,
  });

  // Fetch paginated stories
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchStories = async () => {
      try {
        setLoading(true);
        setError(null);

        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          const cachedIds = await cacheManager.getCachedIds();
          if (cachedIds.length > 0) {
            const cachedStories = await Promise.all(
              cachedIds.map((id) => cacheManager.get(id))
            );
            const normalizedStories = cachedStories
              .filter(Boolean)
              .map(story => normalizeCachedStory(story as CachedStory));
            normalizedStories.sort((a, b) => {
              const dateA = new Date(a.publishedAt || a.createdAt).getTime();
              const dateB = new Date(b.publishedAt || b.createdAt).getTime();
              return dateB - dateA;
            });

            const limitedStories = normalizedStories.slice(0, offlineLimit);
            setStories(limitedStories);
            setHasMore(false);
            setTotalCount(limitedStories.length);
            setLoading(false);
            return;
          }
        }

        // Cleanup previous listener
        if (unsubscribe) unsubscribe();

        const offset = page * 12;
        const params = new URLSearchParams({
          limit: '12',
          offset: offset.toString(),
          jlptLevel: filters.jlptLevel,
          theme: filters.theme,
          sortBy: filters.sortBy,
          search: filters.searchTerm
        });

        const response = await fetch(`/api/stories?${params}`);
        if (!response.ok) throw new Error('Failed to fetch stories');

        const data = await response.json();
        const nextStories = data.stories || [];
        setStories(nextStories);
        setHasMore(data.hasMore || false);
        setTotalCount(data.totalCount || 0);
        setLoading(false);

        if (!isOffline && nextStories.length > 0 && page === 0) {
          cacheManager
            .prefetchStories(nextStories.slice(0, offlineLimit), { skipCached: true })
            .catch((prefetchError) => {
              console.warn('[useStories] Offline prefetch failed:', prefetchError);
            });
        }

        // Setup real-time listener for current page's stories (max 10 due to Firestore 'in' limit)
        if (nextStories.length > 0) {
          const storyIds = nextStories.map((s: Story) => s.id).slice(0, 10);

          unsubscribe = onSnapshot(
            query(
              collection(db, 'stories'),
              where(documentId(), 'in', storyIds)
            ),
            (snapshot) => {
              const updatedStories = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString()
              })) as Story[];

              // Preserve the original sort order from the API
              // Firestore 'in' queries don't guarantee order, so we need to re-sort
              const sortedStories = [...updatedStories].sort((a, b) => {
                // Sort by publishedAt descending (newest first)
                const dateA = new Date(a.publishedAt || a.createdAt).getTime();
                const dateB = new Date(b.publishedAt || b.createdAt).getTime();
                return dateB - dateA;
              });

              setStories(sortedStories);
            },
            (error) => {
              console.error('Error in stories real-time listener:', error);
            }
          );
        }
      } catch (error) {
        console.error('Error fetching stories:', error);
        const cachedIds = await cacheManager.getCachedIds();
        if (cachedIds.length > 0) {
          const cachedStories = await Promise.all(
            cachedIds.map((id) => cacheManager.get(id))
          );
          const normalizedStories = cachedStories
            .filter(Boolean)
            .map(story => normalizeCachedStory(story as CachedStory));
          normalizedStories.sort((a, b) => {
            const dateA = new Date(a.publishedAt || a.createdAt).getTime();
            const dateB = new Date(b.publishedAt || b.createdAt).getTime();
            return dateB - dateA;
          });

          const limitedStories = normalizedStories.slice(0, offlineLimit);
          setStories(limitedStories);
          setHasMore(false);
          setTotalCount(limitedStories.length);
          setLoading(false);
          setError(null);
          return;
        }

        setError('Failed to load stories');
        setLoading(false);
      }
    };

    fetchStories();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [page, filters.jlptLevel, filters.theme, filters.sortBy, filters.searchTerm]);

  // Fetch user progress for stories
  useEffect(() => {
    if (!user) {
      setUserProgress(new Map());
      return;
    }

    const fetchProgress = async () => {
      try {
        const progressQuery = query(
          collection(db, 'storyProgress'),
          where('userId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(
          progressQuery,
          (snapshot) => {
            const progressMap = new Map<string, StoryProgress>();
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              progressMap.set(data.storyId, {
                ...data,
                lastReadAt: data.lastReadAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                completedAt: data.completedAt?.toDate?.()?.toISOString()
              } as StoryProgress);
            });
            setUserProgress(progressMap);
          },
          (error) => {
            const code = (error as { code?: string }).code;
            if (code === 'permission-denied' || !user?.uid) {
              console.warn('[useStories] Story progress listener stopped due to auth change.');
              return;
            }
            console.error('Error fetching story progress:', error);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up progress listener:', error);
      }
    };

    fetchProgress();
  }, [user]);

  // Get a single story by ID
  const getStory = async (storyId: string): Promise<Story | null> => {
    try {
      const storyDoc = await getDoc(doc(db, 'stories', storyId));
      if (storyDoc.exists()) {
        const data = storyDoc.data();
        return {
          id: storyDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          publishedAt: data.publishedAt?.toDate?.()?.toISOString()
        } as Story;
      }
      return null;
    } catch (error) {
      console.error('Error fetching story:', error);
      return null;
    }
  };

  // Create a new story
  const createStory = async (storyData: Omit<Story, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const now = Timestamp.now();
      const docRef = await addDoc(collection(db, 'stories'), {
        ...storyData,
        createdAt: now,
        updatedAt: now,
        viewCount: 0,
        completionCount: 0
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating story:', error);
      throw error;
    }
  };

  // Update an existing story
  const updateStory = async (storyId: string, updates: Partial<Story>) => {
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating story:', error);
      throw error;
    }
  };

  // Delete a story
  const deleteStory = async (storyId: string) => {
    try {
      await deleteDoc(doc(db, 'stories', storyId));
    } catch (error) {
      console.error('Error deleting story:', error);
      throw error;
    }
  };

  // Update user progress for a story
  const updateProgress = async (storyId: string, progress: Partial<StoryProgress>) => {
    if (!user) return;

    try {
      const progressRef = doc(db, 'storyProgress', `${user.uid}_${storyId}`);
      const existingProgress = userProgress.get(storyId);

      if (existingProgress) {
        await updateDoc(progressRef, {
          ...progress,
          updatedAt: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'storyProgress'), {
          storyId,
          userId: user.uid,
          currentPage: 0,
          completed: false,
          quizAttempts: 0,
          savedWords: [],
          progress: 0,
          timeSpent: 0,
          ...progress,
          lastReadAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      throw error;
    }
  };

  // Mark a story as read/completed
  const markAsCompleted = async (storyId: string, quizScore?: number) => {
    if (!user) return;

    try {
      const story = stories.find(s => s.id === storyId);
      if (!story) return;

      await updateProgress(storyId, {
        completed: true,
        completedAt: new Date(),
        progress: 100,
        quizScore,
        currentPage: story.pages.length - 1
      });

      // Increment story completion count
      await updateDoc(doc(db, 'stories', storyId), {
        completionCount: (story.completionCount || 0) + 1
      });
    } catch (error) {
      console.error('Error marking story as completed:', error);
      throw error;
    }
  };

  // Get stories by moodboard ID
  const getStoriesByMoodboard = async (moodboardId: string): Promise<Story[]> => {
    try {
      const storiesQuery = query(
        collection(db, 'stories'),
        where('moodBoardId', '==', moodboardId),
        where('status', '==', 'published')
      );

      const snapshot = await getDocs(storiesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString()
      })) as Story[];
    } catch (error) {
      console.error('Error fetching stories by moodboard:', error);
      return [];
    }
  };

  // Save a word from story
  const saveWord = async (storyId: string, word: string) => {
    if (!user) return;

    try {
      const currentProgress = userProgress.get(storyId);
      const savedWords = currentProgress?.savedWords || [];

      if (!savedWords.includes(word)) {
        await updateProgress(storyId, {
          savedWords: [...savedWords, word]
        });
      }
    } catch (error) {
      console.error('Error saving word:', error);
      throw error;
    }
  };

  // Pagination helper functions
  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(0); // Reset to first page when filters change
  }, []);

  const nextPage = useCallback(() => {
    if (hasMore) setPage(prev => prev + 1);
  }, [hasMore]);

  const previousPage = useCallback(() => {
    if (page > 0) setPage(prev => prev - 1);
  }, [page]);

  const goToPage = useCallback((pageNum: number) => {
    setPage(pageNum);
  }, []);

  return {
    stories,
    userProgress,
    loading,
    error,
    page,
    hasMore,
    totalCount,
    filters,
    updateFilters,
    nextPage,
    previousPage,
    goToPage,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    updateProgress,
    markAsCompleted,
    getStoriesByMoodboard,
    saveWord
  };
}

// Hook for individual story with real-time updates
export function useStory(storyId: string) {
  const [story, setStory] = useState<Story | null>(null);
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!storyId) {
      setLoading(false);
      return;
    }

    const fetchStory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch story
        const storyDoc = await getDoc(doc(db, 'stories', storyId));
        if (storyDoc.exists()) {
          const data = storyDoc.data();
          setStory({
            id: storyDoc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            publishedAt: data.publishedAt?.toDate?.()?.toISOString()
          } as Story);

          // Increment view count
          await updateDoc(doc(db, 'stories', storyId), {
            viewCount: (data.viewCount || 0) + 1
          });
        } else {
          setError('Story not found');
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching story:', error);
        setError('Failed to load story');
        setLoading(false);
      }
    };

    fetchStory();
  }, [storyId]);

  // Fetch user progress
  useEffect(() => {
    if (!user || !storyId) {
      setProgress(null);
      return;
    }

    const progressRef = doc(db, 'storyProgress', `${user.uid}_${storyId}`);

    const unsubscribe = onSnapshot(
      progressRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProgress({
            ...data,
            lastReadAt: data.lastReadAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            completedAt: data.completedAt?.toDate?.()?.toISOString()
          } as StoryProgress);
        }
      },
      (error) => {
        console.error('Error fetching progress:', error);
      }
    );

    return () => unsubscribe();
  }, [user, storyId]);

  return {
    story,
    progress,
    loading,
    error
  };
}
