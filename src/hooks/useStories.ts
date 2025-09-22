import { useState, useEffect } from 'react';
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
  Timestamp
} from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { Story, StoryProgress } from '@/types/story';
import { useAuth } from '@/hooks/useAuth';

export function useStories() {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [userProgress, setUserProgress] = useState<Map<string, StoryProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all published stories
  useEffect(() => {
    const fetchStories = async () => {
      try {
        setLoading(true);
        setError(null);

        const storiesQuery = query(
          collection(db, 'stories'),
          where('status', '==', 'published'),
          orderBy('publishedAt', 'desc')
        );

        const unsubscribe = onSnapshot(
          storiesQuery,
          (snapshot) => {
            const storiesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
              publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString()
            })) as Story[];

            setStories(storiesData);
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching stories:', error);
            setError('Failed to load stories');
            setLoading(false);
          }
        );

        return () => unsubscribe();
      } catch (error) {
        console.error('Error setting up stories listener:', error);
        setError('Failed to load stories');
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

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

  return {
    stories,
    userProgress,
    loading,
    error,
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