/**
 * Hook for managing study lists
 * Provides a convenient interface to StudyListManager with React state management
 */

import { useState, useEffect, useCallback } from 'react';
import { studyListManager } from '@/lib/study-lists/StudyListManager';
import { useSubscription } from '@/hooks/useSubscription';
import type {
  StudyList,
  SavedStudyItem,
  CreateStudyListInput,
  UpdateStudyListInput,
  AddToListInput,
  StudyListFilters,
  StudyItemFilters,
  ListQuota,
} from '@/types/studyList';

interface UseStudyListsOptions {
  user?: any;
  filters?: StudyListFilters;
}

export function useStudyLists(options: UseStudyListsOptions = {}) {
  const { user, filters } = options;
  const { subscription } = useSubscription();
  const [lists, setLists] = useState<StudyList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine user plan
  const getUserPlan = useCallback((): 'guest' | 'free' | 'premium' => {
    if (!user) return 'guest';
    if (subscription?.status === 'active') return 'premium';
    return 'free';
  }, [user, subscription]);

  // Load lists
  const loadLists = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Set user with premium status for proper Firebase sync
      const isPremium = subscription?.status === 'active';
      await studyListManager.setUser(user, isPremium);

      const userLists = await studyListManager.getLists(filters);
      setLists(userLists);
    } catch (err) {
      console.error('Failed to load lists:', err);
      setError('Failed to load lists');
    } finally {
      setIsLoading(false);
    }
  }, [user, subscription?.status, filters?.searchQuery, filters?.type, filters?.sortBy, filters?.sortOrder]);

  // Create list
  const createList = useCallback(async (input: CreateStudyListInput): Promise<StudyList | null> => {
    try {
      const newList = await studyListManager.createList(input);
      setLists(prev => [...prev, newList]);
      return newList;
    } catch (err) {
      console.error('Failed to create list:', err);
      setError('Failed to create list');
      return null;
    }
  }, []);

  // Update list
  const updateList = useCallback(async (listId: string, input: UpdateStudyListInput): Promise<StudyList | null> => {
    try {
      const updatedList = await studyListManager.updateList(listId, input);
      if (updatedList) {
        setLists(prev => prev.map(list =>
          list.id === listId ? updatedList : list
        ));
      }
      return updatedList;
    } catch (err) {
      console.error('Failed to update list:', err);
      setError('Failed to update list');
      return null;
    }
  }, []);

  // Delete list
  const deleteList = useCallback(async (listId: string): Promise<boolean> => {
    try {
      const success = await studyListManager.deleteList(listId);
      if (success) {
        setLists(prev => prev.filter(list => list.id !== listId));
      }
      return success;
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list');
      return false;
    }
  }, []);

  // Get quota info
  const getQuota = useCallback(async (): Promise<ListQuota> => {
    const plan = getUserPlan();
    return studyListManager.getListQuota(plan);
  }, [getUserPlan]);

  // Load lists on mount and when user changes
  useEffect(() => {
    if (user !== undefined) {
      loadLists();
    }
  }, [loadLists, user]);

  return {
    lists,
    isLoading,
    error,
    createList,
    updateList,
    deleteList,
    refreshLists: loadLists,
    getQuota,
    userPlan: getUserPlan(),
  };
}

/**
 * Hook for managing saved study items
 */

interface UseStudyItemsOptions {
  user?: any;
  filters?: StudyItemFilters;
}

export function useStudyItems(options: UseStudyItemsOptions = {}) {
  const { user, filters } = options;
  const { subscription } = useSubscription();
  const [items, setItems] = useState<SavedStudyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load items
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Set user with premium status for proper Firebase sync
      const isPremium = subscription?.status === 'active';
      await studyListManager.setUser(user, isPremium);

      const userItems = await studyListManager.getItems(filters);
      setItems(userItems);
    } catch (err) {
      console.error('Failed to load items:', err);
      setError('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, [user, subscription?.status, filters?.listId, filters?.itemType, filters?.searchQuery, filters?.sortBy]);

  // Add item to lists
  const addToLists = useCallback(async (input: AddToListInput): Promise<SavedStudyItem | null> => {
    try {
      const savedItem = await studyListManager.addToLists(input);

      // Update local state
      setItems(prev => {
        const existingIndex = prev.findIndex(item => item.id === savedItem.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = savedItem;
          return updated;
        }
        return [...prev, savedItem];
      });

      return savedItem;
    } catch (err) {
      console.error('Failed to add item to lists:', err);
      setError('Failed to add item');
      return null;
    }
  }, []);

  // Remove item from list
  const removeFromList = useCallback(async (itemId: string, listId: string): Promise<boolean> => {
    try {
      const success = await studyListManager.removeFromList(itemId, listId);

      if (success) {
        // Reload items to get updated state
        await loadItems();
      }

      return success;
    } catch (err) {
      console.error('Failed to remove item from list:', err);
      setError('Failed to remove item');
      return false;
    }
  }, [loadItems]);

  // Get items for a specific list
  const getListItems = useCallback(async (listId: string): Promise<SavedStudyItem[]> => {
    try {
      return await studyListManager.getListItems(listId);
    } catch (err) {
      console.error('Failed to get list items:', err);
      setError('Failed to get list items');
      return [];
    }
  }, []);

  // Load items on mount and when user changes
  useEffect(() => {
    if (user !== undefined) {
      loadItems();
    }
  }, [loadItems, user]);

  return {
    items,
    isLoading,
    error,
    addToLists,
    removeFromList,
    getListItems,
    refreshItems: loadItems,
  };
}

/**
 * Hook for managing a single study list
 */

interface UseStudyListOptions {
  user?: any;
  listId: string;
}

export function useStudyList(options: UseStudyListOptions) {
  const { user, listId } = options;
  const { subscription } = useSubscription();
  const [list, setList] = useState<StudyList | null>(null);
  const [items, setItems] = useState<SavedStudyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load list and its items
  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Set user with premium status for proper Firebase sync
      const isPremium = subscription?.status === 'active';
      await studyListManager.setUser(user, isPremium);

      const [listData, listItems] = await Promise.all([
        studyListManager.getList(listId),
        studyListManager.getListItems(listId),
      ]);

      setList(listData);
      setItems(listItems);
    } catch (err) {
      console.error('Failed to load list:', err);
      setError('Failed to load list');
    } finally {
      setIsLoading(false);
    }
  }, [user, subscription?.status, listId]);

  // Update list
  const updateList = useCallback(async (input: UpdateStudyListInput): Promise<boolean> => {
    try {
      const updatedList = await studyListManager.updateList(listId, input);
      if (updatedList) {
        setList(updatedList);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update list:', err);
      setError('Failed to update list');
      return false;
    }
  }, [listId]);

  // Remove item from this list
  const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const success = await studyListManager.removeFromList(itemId, listId);

      if (success) {
        setItems(prev => prev.filter(item => item.id !== itemId));
      }

      return success;
    } catch (err) {
      console.error('Failed to remove item:', err);
      setError('Failed to remove item');
      return false;
    }
  }, [listId]);

  // Load on mount
  useEffect(() => {
    if (user !== undefined && listId) {
      loadList();
    }
  }, [loadList, user, listId]);

  return {
    list,
    items,
    isLoading,
    error,
    updateList,
    removeItem,
    refresh: loadList,
  };
}