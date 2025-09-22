'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  Timestamp,
  where
} from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { MoodBoard } from '@/types/moodboard';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface UseMoodBoardsReturn {
  moodBoards: MoodBoard[];
  loading: boolean;
  error: string | null;
  refreshMoodBoards: () => Promise<void>;
  createMoodBoard: (board: Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateMoodBoard: (id: string, updates: Partial<MoodBoard>) => Promise<void>;
  deleteMoodBoard: (id: string) => Promise<void>;
  toggleMoodBoardStatus: (id: string, isActive: boolean) => Promise<void>;
}

// Interface for Firebase mood board document
interface FirebaseMoodBoard {
  id: string;
  title?: string;
  emoji?: string;
  jlpt?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  background?: string;
  description?: string;
  kanji?: any[];
  createdAt?: any; // Firestore timestamp
  updatedAt?: any; // Firestore timestamp
  createdBy?: string;
  isActive?: boolean;
  sortOrder?: number;
  [key: string]: any;
}

// Convert Firestore timestamp to Date
function timestampToDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return new Date();
}

// Convert Firebase mood board to MoodBoard
function convertFirebaseMoodBoard(firebaseMoodBoard: FirebaseMoodBoard): MoodBoard {
  return {
    id: firebaseMoodBoard.id,
    title: firebaseMoodBoard.title || 'Untitled',
    emoji: firebaseMoodBoard.emoji || '🎨',
    jlpt: firebaseMoodBoard.jlpt || 'N5',
    background: firebaseMoodBoard.background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    description: firebaseMoodBoard.description || '',
    kanji: firebaseMoodBoard.kanji || [],
    createdAt: timestampToDate(firebaseMoodBoard.createdAt),
    updatedAt: firebaseMoodBoard.updatedAt ? timestampToDate(firebaseMoodBoard.updatedAt) : undefined,
    createdBy: firebaseMoodBoard.createdBy || 'admin',
    isActive: firebaseMoodBoard.isActive ?? true,
    sortOrder: firebaseMoodBoard.sortOrder || 0,
  };
}

export function useMoodBoards(): UseMoodBoardsReturn {
  const [moodBoards, setMoodBoards] = useState<MoodBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const fetchMoodBoards = async () => {
    try {
      setError(null);

      if (!db) {
        console.error('Firebase Firestore not initialized');
        setError('Database connection failed');
        setMoodBoards([]);
        setLoading(false);
        return;
      }

      const moodBoardsRef = collection(db, 'moodBoards');
      const q = query(moodBoardsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      const fetchedMoodBoards: MoodBoard[] = snapshot.docs.map(doc => {
        const firebaseMoodBoard: FirebaseMoodBoard = {
          id: doc.id,
          ...doc.data()
        };
        return convertFirebaseMoodBoard(firebaseMoodBoard);
      });

      // Sort by sortOrder first, then by createdAt
      fetchedMoodBoards.sort((a, b) => {
        const aSortOrder = a.sortOrder || 0;
        const bSortOrder = b.sortOrder || 0;
        if (aSortOrder !== bSortOrder) {
          return aSortOrder - bSortOrder;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      setMoodBoards(fetchedMoodBoards);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching mood boards:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch mood boards');
      setMoodBoards([]);
      setLoading(false);
    }
  };

  const refreshMoodBoards = async () => {
    setLoading(true);

    try {
      // Clear existing data first to ensure UI updates
      setMoodBoards([]);

      // Add a small delay to ensure state update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fetch fresh data
      await fetchMoodBoards();
    } catch (error) {
      console.error('Error in refreshMoodBoards:', error);
      setLoading(false);
    }
  };

  const createMoodBoard = async (board: Omit<MoodBoard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const moodBoardsRef = collection(db, 'moodBoards');
      const newBoard = {
        ...board,
        createdAt: Timestamp.now(),
        createdBy: 'admin',
        isActive: board.isActive ?? true,
        sortOrder: board.sortOrder ?? 0,
      };

      const docRef = await addDoc(moodBoardsRef, newBoard);

      showToast(`Mood board "${board.title}" created successfully`, 'success');

      await refreshMoodBoards();
      return docRef.id;
    } catch (err) {
      console.error('Error creating mood board:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to create mood board',
        'error'
      );
      throw new Error(err instanceof Error ? err.message : 'Failed to create mood board');
    }
  };

  const updateMoodBoard = async (id: string, updates: Partial<MoodBoard>): Promise<void> => {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const moodBoardRef = doc(db, 'moodBoards', id);
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      await updateDoc(moodBoardRef, updateData);

      showToast('Mood board updated successfully', 'success');

      await refreshMoodBoards();
    } catch (err) {
      console.error('Error updating mood board:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to update mood board',
        'error'
      );
      throw new Error(err instanceof Error ? err.message : 'Failed to update mood board');
    }
  };

  const deleteMoodBoard = async (id: string): Promise<void> => {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const moodBoardRef = doc(db, 'moodBoards', id);

      // Get mood board details for logging before deletion
      const boardToDelete = moodBoards.find(board => board.id === id);

      await deleteDoc(moodBoardRef);

      showToast(
        `Mood board "${boardToDelete?.title || 'Unknown'}" deleted successfully`,
        'success'
      );

      await refreshMoodBoards();
    } catch (err) {
      console.error('Error deleting mood board:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to delete mood board',
        'error'
      );
      throw new Error(err instanceof Error ? err.message : 'Failed to delete mood board');
    }
  };

  const toggleMoodBoardStatus = async (id: string, isActive: boolean): Promise<void> => {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const moodBoardRef = doc(db, 'moodBoards', id);
      await updateDoc(moodBoardRef, {
        isActive,
        updatedAt: Timestamp.now(),
      });

      const board = moodBoards.find(b => b.id === id);
      showToast(
        `Mood board "${board?.title || 'Unknown'}" ${isActive ? 'activated' : 'deactivated'}`,
        'success'
      );

      await refreshMoodBoards();
    } catch (err) {
      console.error('Error toggling mood board status:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to toggle mood board status',
        'error'
      );
      throw new Error(err instanceof Error ? err.message : 'Failed to toggle mood board status');
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupRealtimeListener = () => {
      if (!db) {
        fetchMoodBoards();
        return;
      }

      const moodBoardsRef = collection(db, 'moodBoards');
      const q = query(moodBoardsRef, orderBy('createdAt', 'desc'));

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            const fetchedMoodBoards: MoodBoard[] = snapshot.docs.map(doc => {
              const firebaseMoodBoard: FirebaseMoodBoard = {
                id: doc.id,
                ...doc.data()
              };
              return convertFirebaseMoodBoard(firebaseMoodBoard);
            });

            // Sort by sortOrder first, then by createdAt
            fetchedMoodBoards.sort((a, b) => {
              const aSortOrder = a.sortOrder || 0;
              const bSortOrder = b.sortOrder || 0;
              if (aSortOrder !== bSortOrder) {
                return aSortOrder - bSortOrder;
              }
              return b.createdAt.getTime() - a.createdAt.getTime();
            });

            setMoodBoards(fetchedMoodBoards);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('Error processing mood board snapshot:', err);
            setError(err instanceof Error ? err.message : 'Failed to process mood boards');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Error in mood boards snapshot listener:', err);
          setError(err.message || 'Failed to listen to mood board changes');
          setLoading(false);

          // Fallback to one-time fetch
          fetchMoodBoards();
        }
      );
    };

    setupRealtimeListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return {
    moodBoards,
    loading,
    error,
    refreshMoodBoards,
    createMoodBoard,
    updateMoodBoard,
    deleteMoodBoard,
    toggleMoodBoardStatus,
  };
}

// Utility function to search mood boards
export function searchMoodBoards(moodBoards: MoodBoard[], query: string): MoodBoard[] {
  if (!query.trim()) return moodBoards;

  const searchTerm = query.toLowerCase();
  return moodBoards.filter(board =>
    board.title.toLowerCase().includes(searchTerm) ||
    board.emoji.includes(searchTerm) ||
    board.description?.toLowerCase().includes(searchTerm) ||
    board.kanji.some(k =>
      k.char.includes(searchTerm) ||
      k.meaning?.toLowerCase().includes(searchTerm)
    )
  );
}

// Utility function to filter mood boards by JLPT level
export function filterMoodBoardsByJLPT(
  moodBoards: MoodBoard[],
  jlpt: 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
): MoodBoard[] {
  if (jlpt === 'all') return moodBoards;
  return moodBoards.filter(board => board.jlpt === jlpt);
}