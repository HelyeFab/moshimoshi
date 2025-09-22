/**
 * StudyListManager - Core service for managing user's custom study lists
 * Handles offline-first storage with IndexedDB and localStorage fallback
 */

import type {
  StudyList,
  SavedStudyItem,
  CreateStudyListInput,
  UpdateStudyListInput,
  AddToListInput,
  StudyListFilters,
  StudyItemFilters,
  ValidationResult,
  ListQuota,
  StudyListType,
  StudyItemType,
} from '@/types/studyList';
import { STUDY_LIST_COLORS } from '@/types/studyList';
import type { VocabularyWord, JapaneseWord } from '@/types/vocabulary';
import { isDrillable } from '@/types/vocabulary';
import type { KanjiData } from '@/types/kanji';
import { firebaseSync } from './FirebaseSync';
import type { User } from 'firebase/auth';

// Storage keys
const LISTS_STORAGE_KEY = 'moshimoshi_study_lists';
const ITEMS_STORAGE_KEY = 'moshimoshi_saved_items';
const SYNC_QUEUE_KEY = 'moshimoshi_sync_queue';

// IndexedDB config
const DB_NAME = 'MoshimoshiStudyLists';
const DB_VERSION = 1;
const LISTS_STORE = 'studyLists';
const ITEMS_STORE = 'savedItems';

// Singleton instance
let instance: StudyListManager | null = null;

export class StudyListManager {
  private db: IDBDatabase | null = null;
  private isIndexedDBAvailable = false;
  private userId: string | null = null;
  private listCache: Map<string, StudyList> = new Map();
  private itemCache: Map<string, SavedStudyItem> = new Map();
  private isPremium: boolean = false;
  private user: User | null = null;

  constructor() {
    if (instance) {
      return instance;
    }
    instance = this;
    this.initializeStorage();
    this.setupRemoteChangeListeners();
  }

  /**
   * Initialize storage (IndexedDB with localStorage fallback)
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Check if IndexedDB is available
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        await this.initializeIndexedDB();
      }
    } catch (error) {
      console.warn('IndexedDB initialization failed, using localStorage:', error);
      this.isIndexedDBAvailable = false;
    }
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isIndexedDBAvailable = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create study lists store
        if (!db.objectStoreNames.contains(LISTS_STORE)) {
          const listsStore = db.createObjectStore(LISTS_STORE, { keyPath: 'id' });
          listsStore.createIndex('userId', 'userId', { unique: false });
          listsStore.createIndex('type', 'type', { unique: false });
          listsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create saved items store
        if (!db.objectStoreNames.contains(ITEMS_STORE)) {
          const itemsStore = db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
          itemsStore.createIndex('userId', 'userId', { unique: false });
          itemsStore.createIndex('itemType', 'itemType', { unique: false });
          itemsStore.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Set the current user ID and premium status
   */
  public async setUser(user: User | null, isPremium: boolean = false): Promise<void> {
    this.user = user;
    this.userId = user?.uid || null;
    this.isPremium = isPremium;
    this.clearCache();

    // Initialize Firebase sync for premium users
    await firebaseSync.initialize(user, isPremium);

    // Sync data from cloud if premium
    if (isPremium && user) {
      await this.syncFromCloud();
    }
  }

  /**
   * Set the current user ID (legacy support)
   */
  public setUserId(userId: string | null): void {
    this.userId = userId;
    this.clearCache();
  }

  /**
   * Clear in-memory caches
   */
  private clearCache(): void {
    this.listCache.clear();
    this.itemCache.clear();
  }

  /**
   * Setup listeners for remote changes
   */
  private setupRemoteChangeListeners(): void {
    // Only set up listeners in browser environment
    if (typeof window === 'undefined') return;

    // Listen for remote changes from Firebase
    window.addEventListener('studylist:remote-change', (event: any) => {
      const { type, data } = event.detail;

      if (type === 'list') {
        // Update local cache with remote list
        this.listCache.set(data.id, data);
        // Save to local storage
        this.saveListToLocalStorage(data);
      } else if (type === 'item') {
        // Update local cache with remote item
        this.itemCache.set(data.id, data);
        // Save to local storage
        this.saveItemToLocalStorage(data);
      }
    });
  }

  /**
   * Sync data from cloud (for premium users)
   */
  private async syncFromCloud(): Promise<void> {
    if (!this.isPremium) return;

    try {
      // Fetch lists and items from Firebase
      const [cloudLists, cloudItems] = await Promise.all([
        firebaseSync.fetchLists(),
        firebaseSync.fetchItems(),
      ]);

      // Merge with local data (cloud takes precedence)
      const localLists = await this.loadListsFromLocalStorage();
      const localItems = await this.loadItemsFromLocalStorage();

      // Use version numbers to resolve conflicts
      const mergedLists = this.mergeData(localLists, cloudLists);
      const mergedItems = this.mergeData(localItems, cloudItems);

      // Save merged data
      await this.saveListsToLocalStorage(mergedLists);
      await this.saveItemsToLocalStorage(mergedItems);

      // Update caches
      mergedLists.forEach(list => this.listCache.set(list.id, list));
      mergedItems.forEach(item => this.itemCache.set(item.id, item));
    } catch (error) {
      console.error('Failed to sync from cloud:', error);
    }
  }

  /**
   * Merge local and cloud data based on version numbers
   */
  private mergeData<T extends { id: string; version: number; updatedAt: number }>(
    local: T[],
    cloud: T[]
  ): T[] {
    const merged = new Map<string, T>();

    // Add all local items
    local.forEach(item => merged.set(item.id, item));

    // Merge cloud items (cloud wins if newer)
    cloud.forEach(cloudItem => {
      const localItem = merged.get(cloudItem.id);
      if (!localItem || cloudItem.version > localItem.version ||
          cloudItem.updatedAt > localItem.updatedAt) {
        merged.set(cloudItem.id, cloudItem);
      }
    });

    return Array.from(merged.values());
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all study lists for current user
   */
  public async getLists(filters?: StudyListFilters): Promise<StudyList[]> {
    const lists = await this.loadLists();

    if (!filters) {
      return lists;
    }

    return this.applyListFilters(lists, filters);
  }

  /**
   * Get a single study list by ID
   */
  public async getList(listId: string): Promise<StudyList | null> {
    if (this.listCache.has(listId)) {
      return this.listCache.get(listId)!;
    }

    const lists = await this.loadLists();
    return lists.find(list => list.id === listId) || null;
  }

  /**
   * Create a new study list
   */
  public async createList(input: CreateStudyListInput): Promise<StudyList> {
    const now = Date.now();
    const newList: StudyList = {
      id: this.generateId(),
      userId: this.userId || 'local',
      name: input.name,
      description: input.description,
      type: input.type,
      itemIds: [],
      color: input.color || STUDY_LIST_COLORS[0],
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
      version: 1,
      stats: {
        totalReviews: 0,
        averageAccuracy: 0,
        masteredCount: 0,
        learningCount: 0,
      },
    };

    await this.saveList(newList);

    // Sync to Firebase if premium
    if (this.isPremium) {
      firebaseSync.syncList(newList);
    }

    return newList;
  }

  /**
   * Update a study list
   */
  public async updateList(listId: string, input: UpdateStudyListInput): Promise<StudyList | null> {
    const list = await this.getList(listId);
    if (!list) {
      return null;
    }

    const updatedList: StudyList = {
      ...list,
      ...input,
      updatedAt: Date.now(),
      version: list.version + 1,
    };

    await this.saveList(updatedList);

    // Sync to Firebase if premium
    if (this.isPremium) {
      firebaseSync.syncList(updatedList);
    }

    return updatedList;
  }

  /**
   * Delete a study list
   */
  public async deleteList(listId: string): Promise<boolean> {
    const lists = await this.loadLists();
    const filteredLists = lists.filter(list => list.id !== listId);

    if (lists.length === filteredLists.length) {
      return false; // List not found
    }

    // Remove list ID from all saved items
    const items = await this.loadItems();
    const updatedItems = items.map(item => ({
      ...item,
      listIds: item.listIds.filter(id => id !== listId),
    }));

    await this.saveLists(filteredLists);
    await this.saveItems(updatedItems);

    this.listCache.delete(listId);

    // Delete from Firebase if premium
    if (this.isPremium) {
      firebaseSync.deleteList(listId);
    }

    return true;
  }

  /**
   * Add an item to one or more lists
   */
  public async addToLists(input: AddToListInput): Promise<SavedStudyItem> {
    // First validate that item can be added to all specified lists
    const validation = await this.validateAddToLists(input);
    if (!validation.isValid) {
      throw new Error(validation.reason);
    }

    // Check if item already exists
    let savedItem = await this.findItemByContent(input.itemType, input.itemId);

    const now = Date.now();

    if (savedItem) {
      // Update existing item
      savedItem.listIds = Array.from(new Set([...savedItem.listIds, ...input.listIds]));
      savedItem.lastModified = now;
      savedItem.version += 1;
      if (input.notes) savedItem.notes = input.notes;
      if (input.tags) savedItem.tags = input.tags;
    } else {
      // Create new saved item
      const content = await this.getItemContent(input.itemType, input.itemId);

      savedItem = {
        id: this.generateId(),
        userId: this.userId || 'local',
        itemType: input.itemType,
        [`${input.itemType}Id`]: input.itemId,
        content,
        listIds: input.listIds,
        savedAt: now,
        lastModified: now,
        notes: input.notes,
        tags: input.tags,
        version: 1,
      };
    }

    // Update lists to include this item
    for (const listId of input.listIds) {
      const list = await this.getList(listId);
      if (list && !list.itemIds.includes(savedItem.id)) {
        list.itemIds.push(savedItem.id);
        list.updatedAt = now;
        list.version += 1;
        await this.saveList(list);
      }
    }

    await this.saveItem(savedItem);

    // Sync to Firebase if premium
    if (this.isPremium) {
      firebaseSync.syncItem(savedItem);
      // Also sync updated lists
      for (const listId of input.listIds) {
        const list = await this.getList(listId);
        if (list) {
          firebaseSync.syncList(list);
        }
      }
    }

    return savedItem;
  }

  /**
   * Remove an item from a list
   */
  public async removeFromList(itemId: string, listId: string): Promise<boolean> {
    const [item, list] = await Promise.all([
      this.getItem(itemId),
      this.getList(listId)
    ]);

    if (!item || !list) {
      return false;
    }

    // Remove from item's list IDs
    item.listIds = item.listIds.filter(id => id !== listId);
    item.lastModified = Date.now();
    item.version += 1;

    // Remove from list's item IDs
    list.itemIds = list.itemIds.filter(id => id !== itemId);
    list.updatedAt = Date.now();
    list.version += 1;

    // If item is no longer in any list, delete it
    if (item.listIds.length === 0) {
      await this.deleteItem(itemId);
    } else {
      await this.saveItem(item);
    }

    await this.saveList(list);
    return true;
  }

  /**
   * Get saved items with optional filters
   */
  public async getItems(filters?: StudyItemFilters): Promise<SavedStudyItem[]> {
    const items = await this.loadItems();

    if (!filters) {
      return items;
    }

    return this.applyItemFilters(items, filters);
  }

  /**
   * Get a single saved item
   */
  public async getItem(itemId: string): Promise<SavedStudyItem | null> {
    if (this.itemCache.has(itemId)) {
      return this.itemCache.get(itemId)!;
    }

    const items = await this.loadItems();
    return items.find(item => item.id === itemId) || null;
  }

  /**
   * Get items for a specific list
   */
  public async getListItems(listId: string): Promise<SavedStudyItem[]> {
    const list = await this.getList(listId);
    if (!list) {
      return [];
    }

    const items = await Promise.all(
      list.itemIds.map(itemId => this.getItem(itemId))
    );

    return items.filter((item): item is SavedStudyItem => item !== null);
  }

  /**
   * Check if content type can be added to a list type
   */
  public canAddToList(listType: StudyListType, itemType: StudyItemType, item?: any): boolean {
    // Flashcard lists accept any content
    if (listType === 'flashcard') {
      return true;
    }

    // Sentence lists only accept sentences
    if (listType === 'sentence') {
      return itemType === 'sentence';
    }

    // Drillable lists only accept conjugable words (verbs/adjectives)
    if (listType === 'drillable') {
      if (itemType !== 'word') {
        return false;
      }
      return this.isConjugableWord(item);
    }

    return false;
  }

  /**
   * Check if a word is conjugable (verb or adjective)
   * Enhanced detection logic using smart type detection
   */
  private isConjugableWord(word?: any): boolean {
    if (!word) return false;

    // Use the smart detection from vocabulary types if available
    if ('type' in word || 'partsOfSpeech' in word) {
      return isDrillable(word as JapaneseWord);
    }

    // Legacy support for VocabularyWord format
    // Explicit conjugable types (highest priority)
    const explicitConjugableTypes = [
      'Ichidan', 'Godan', 'Irregular',
      'i-adjective', 'na-adjective'
    ];

    // Check explicit types first
    if (word.detailedMeaning?.partOfSpeech) {
      const hasExplicitType = word.detailedMeaning.partOfSpeech.some((pos: string) =>
        explicitConjugableTypes.some(type =>
          pos.includes(type)
        )
      );
      if (hasExplicitType) return true;
    }

    // Comprehensive part of speech patterns
    const conjugablePOSPatterns = [
      // Verbs
      'verb', 'v1', 'v5', 'vk', 'vs', 'vz', 'vi', 'vt',
      'ichidan', 'godan', 'irregular', 'suru',
      '動詞', // Japanese for verb

      // Adjectives
      'adjective', 'adj', 'i-adj', 'na-adj',
      'i-adjective', 'na-adjective',
      '形容詞', '形容動詞', // Japanese for adjective types
    ];

    // Check if any POS matches patterns
    if (word.detailedMeaning?.partOfSpeech) {
      const hasConjugablePOS = word.detailedMeaning.partOfSpeech.some(pos => {
        const posLower = pos.toLowerCase();
        return conjugablePOSPatterns.some(pattern =>
          posLower.includes(pattern.toLowerCase())
        );
      });
      if (hasConjugablePOS) return true;
    }

    // Advanced fallback: Check word endings for verb/adjective patterns
    const reading = word.reading || word.word;

    // Comprehensive verb endings (all possible godan endings + ichidan)
    const verbEndings = [
      'る', 'す', 'く', 'ぐ', 'む', 'ぬ', 'ぶ', 'つ', 'う',
      // Special patterns
      'する', 'くる', // suru and kuru verbs
    ];

    // Adjective endings
    const iAdjEndings = ['い', 'しい', 'じい', 'りい'];
    const naAdjEndings = ['な'];

    // Check verb endings
    const hasVerbEnding = verbEndings.some(ending =>
      reading.endsWith(ending)
    );

    // Check i-adjective endings (but exclude common non-adjectives)
    const hasIAdjEnding = iAdjEndings.some(ending =>
      reading.endsWith(ending) &&
      !reading.endsWith('ない') // Exclude negative forms that aren't adjectives
    );

    // Check na-adjective (usually needs context, so less reliable)
    const hasNaAdjEnding = naAdjEndings.some(ending =>
      reading.endsWith(ending)
    );

    return hasVerbEnding || hasIAdjEnding || hasNaAdjEnding;
  }

  /**
   * Get user's list quota information
   */
  public async getListQuota(planType: 'guest' | 'free' | 'premium'): Promise<ListQuota> {
    const lists = await this.getLists();
    const used = lists.length;

    // Get limit based on plan type (matching doshi-sensei)
    let limit: number;
    switch (planType) {
      case 'guest':
        limit = 0;
        break;
      case 'free':
        limit = 3;  // Free users get 3 lists
        break;
      case 'premium':
        limit = -1; // Unlimited
        break;
    }

    return {
      used,
      limit,
      canCreate: limit === -1 || used < limit,
      isUnlimited: limit === -1,
    };
  }

  /**
   * Validate if items can be added to lists
   */
  private async validateAddToLists(input: AddToListInput): Promise<ValidationResult> {
    const incompatibleLists: string[] = [];

    // Load the actual item to check compatibility
    const item = await this.loadItemData(input.itemType, input.itemId);

    for (const listId of input.listIds) {
      const list = await this.getList(listId);
      if (!list) {
        return {
          isValid: false,
          reason: `List ${listId} not found`,
        };
      }

      if (!this.canAddToList(list.type, input.itemType, item)) {
        incompatibleLists.push(listId);
      }
    }

    if (incompatibleLists.length > 0) {
      return {
        isValid: false,
        reason: 'Some lists cannot accept this item type',
        incompatibleLists,
      };
    }

    return { isValid: true };
  }

  /**
   * Load item data for validation
   */
  private async loadItemData(itemType: StudyItemType, itemId: string): Promise<any> {
    // This would normally load from the actual data source
    // For now, returning null (will be implemented when integrating with vocabulary/kanji data)
    return null;
  }

  /**
   * Get content for an item
   */
  private async getItemContent(itemType: StudyItemType, itemId: string): Promise<SavedStudyItem['content']> {
    // This will be implemented when integrating with vocabulary/kanji data
    // For now, return placeholder content
    return {
      primary: itemId,
      meaning: 'Placeholder meaning',
    };
  }

  /**
   * Find existing saved item by content reference
   */
  private async findItemByContent(itemType: StudyItemType, itemId: string): Promise<SavedStudyItem | null> {
    const items = await this.loadItems();
    const key = `${itemType}Id`;
    return items.find(item =>
      item.itemType === itemType && item[key as keyof SavedStudyItem] === itemId
    ) || null;
  }

  /**
   * Apply filters to lists
   */
  private applyListFilters(lists: StudyList[], filters: StudyListFilters): StudyList[] {
    let filtered = [...lists];

    if (filters.type) {
      filtered = filtered.filter(list => list.type === filters.type);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(list =>
        list.name.toLowerCase().includes(query) ||
        list.description?.toLowerCase().includes(query)
      );
    }

    if (filters.minItemCount !== undefined) {
      filtered = filtered.filter(list => list.itemIds.length >= filters.minItemCount!);
    }

    if (filters.maxItemCount !== undefined) {
      filtered = filtered.filter(list => list.itemIds.length <= filters.maxItemCount!);
    }

    // Sort
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'created':
            comparison = a.createdAt - b.createdAt;
            break;
          case 'updated':
            comparison = a.updatedAt - b.updatedAt;
            break;
          case 'itemCount':
            comparison = a.itemIds.length - b.itemIds.length;
            break;
        }

        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }

  /**
   * Apply filters to items
   */
  private applyItemFilters(items: SavedStudyItem[], filters: StudyItemFilters): SavedStudyItem[] {
    let filtered = [...items];

    if (filters.itemType) {
      filtered = filtered.filter(item => item.itemType === filters.itemType);
    }

    if (filters.listId) {
      filtered = filtered.filter(item => item.listIds.includes(filters.listId!));
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.content.primary.toLowerCase().includes(query) ||
        item.content.meaning.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query)
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(item =>
        item.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    if (filters.mastered !== undefined) {
      filtered = filtered.filter(item =>
        item.reviewData?.mastered === filters.mastered
      );
    }

    // Sort
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;

        switch (filters.sortBy) {
          case 'saved':
            comparison = a.savedAt - b.savedAt;
            break;
          case 'reviewed':
            comparison = (a.reviewData?.lastReviewedAt || 0) - (b.reviewData?.lastReviewedAt || 0);
            break;
          case 'accuracy':
            const aAccuracy = a.reviewData ? (a.reviewData.correctCount / a.reviewData.reviewCount) : 0;
            const bAccuracy = b.reviewData ? (b.reviewData.correctCount / b.reviewData.reviewCount) : 0;
            comparison = aAccuracy - bAccuracy;
            break;
        }

        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }

  // Storage operations

  private async loadLists(): Promise<StudyList[]> {
    if (this.isIndexedDBAvailable && this.db) {
      return this.loadListsFromIndexedDB();
    }
    return this.loadListsFromLocalStorage();
  }

  private async loadItems(): Promise<SavedStudyItem[]> {
    if (this.isIndexedDBAvailable && this.db) {
      return this.loadItemsFromIndexedDB();
    }
    return this.loadItemsFromLocalStorage();
  }

  private async saveList(list: StudyList): Promise<void> {
    this.listCache.set(list.id, list);

    if (this.isIndexedDBAvailable && this.db) {
      await this.saveListToIndexedDB(list);
    } else {
      await this.saveListToLocalStorage(list);
    }
  }

  private async saveLists(lists: StudyList[]): Promise<void> {
    if (this.isIndexedDBAvailable && this.db) {
      await this.saveListsToIndexedDB(lists);
    } else {
      await this.saveListsToLocalStorage(lists);
    }
  }

  private async saveItem(item: SavedStudyItem): Promise<void> {
    this.itemCache.set(item.id, item);

    if (this.isIndexedDBAvailable && this.db) {
      await this.saveItemToIndexedDB(item);
    } else {
      await this.saveItemToLocalStorage(item);
    }
  }

  private async saveItems(items: SavedStudyItem[]): Promise<void> {
    if (this.isIndexedDBAvailable && this.db) {
      await this.saveItemsToIndexedDB(items);
    } else {
      await this.saveItemsToLocalStorage(items);
    }
  }

  private async deleteItem(itemId: string): Promise<void> {
    this.itemCache.delete(itemId);

    if (this.isIndexedDBAvailable && this.db) {
      await this.deleteItemFromIndexedDB(itemId);
    } else {
      await this.deleteItemFromLocalStorage(itemId);
    }
  }

  // IndexedDB operations

  private async loadListsFromIndexedDB(): Promise<StudyList[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([LISTS_STORE], 'readonly');
      const store = transaction.objectStore(LISTS_STORE);
      const index = store.index('userId');
      const request = index.getAll(this.userId || 'local');

      request.onsuccess = () => {
        const lists = request.result.filter(list => !list.deleted);
        lists.forEach(list => this.listCache.set(list.id, list));
        resolve(lists);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async loadItemsFromIndexedDB(): Promise<SavedStudyItem[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readonly');
      const store = transaction.objectStore(ITEMS_STORE);
      const index = store.index('userId');
      const request = index.getAll(this.userId || 'local');

      request.onsuccess = () => {
        const items = request.result;
        items.forEach(item => this.itemCache.set(item.id, item));
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async saveListToIndexedDB(list: StudyList): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([LISTS_STORE], 'readwrite');
      const store = transaction.objectStore(LISTS_STORE);
      const request = store.put(list);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveListsToIndexedDB(lists: StudyList[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([LISTS_STORE], 'readwrite');
      const store = transaction.objectStore(LISTS_STORE);

      // Clear existing lists for user
      const clearRequest = store.index('userId').openCursor(IDBKeyRange.only(this.userId || 'local'));

      clearRequest.onsuccess = () => {
        const cursor = clearRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Add new lists
          lists.forEach(list => {
            store.put(list);
            this.listCache.set(list.id, list);
          });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async saveItemToIndexedDB(item: SavedStudyItem): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readwrite');
      const store = transaction.objectStore(ITEMS_STORE);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async saveItemsToIndexedDB(items: SavedStudyItem[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readwrite');
      const store = transaction.objectStore(ITEMS_STORE);

      // Clear existing items for user
      const clearRequest = store.index('userId').openCursor(IDBKeyRange.only(this.userId || 'local'));

      clearRequest.onsuccess = () => {
        const cursor = clearRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Add new items
          items.forEach(item => {
            store.put(item);
            this.itemCache.set(item.id, item);
          });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async deleteItemFromIndexedDB(itemId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ITEMS_STORE], 'readwrite');
      const store = transaction.objectStore(ITEMS_STORE);
      const request = store.delete(itemId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // localStorage operations

  private loadListsFromLocalStorage(): StudyList[] {
    try {
      const stored = localStorage.getItem(LISTS_STORAGE_KEY);
      if (!stored) return [];

      const allLists: StudyList[] = JSON.parse(stored);
      const userLists = allLists.filter(list =>
        list.userId === (this.userId || 'local') && !list.deleted
      );

      userLists.forEach(list => this.listCache.set(list.id, list));
      return userLists;
    } catch (error) {
      console.error('Failed to load lists from localStorage:', error);
      return [];
    }
  }

  private loadItemsFromLocalStorage(): SavedStudyItem[] {
    try {
      const stored = localStorage.getItem(ITEMS_STORAGE_KEY);
      if (!stored) return [];

      const allItems: SavedStudyItem[] = JSON.parse(stored);
      const userItems = allItems.filter(item =>
        item.userId === (this.userId || 'local')
      );

      userItems.forEach(item => this.itemCache.set(item.id, item));
      return userItems;
    } catch (error) {
      console.error('Failed to load items from localStorage:', error);
      return [];
    }
  }

  private async saveListToLocalStorage(list: StudyList): Promise<void> {
    const lists = this.loadListsFromLocalStorage();
    const index = lists.findIndex(l => l.id === list.id);

    if (index >= 0) {
      lists[index] = list;
    } else {
      lists.push(list);
    }

    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(lists));
  }

  private async saveListsToLocalStorage(lists: StudyList[]): Promise<void> {
    const allLists = this.loadListsFromLocalStorage()
      .filter(list => list.userId !== (this.userId || 'local'));

    allLists.push(...lists);
    lists.forEach(list => this.listCache.set(list.id, list));

    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(allLists));
  }

  private async saveItemToLocalStorage(item: SavedStudyItem): Promise<void> {
    const items = this.loadItemsFromLocalStorage();
    const index = items.findIndex(i => i.id === item.id);

    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }

    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }

  private async saveItemsToLocalStorage(items: SavedStudyItem[]): Promise<void> {
    const allItems = this.loadItemsFromLocalStorage()
      .filter(item => item.userId !== (this.userId || 'local'));

    allItems.push(...items);
    items.forEach(item => this.itemCache.set(item.id, item));

    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(allItems));
  }

  private async deleteItemFromLocalStorage(itemId: string): Promise<void> {
    const items = this.loadItemsFromLocalStorage()
      .filter(item => item.id !== itemId);

    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  }
}

// Export singleton instance
export const studyListManager = new StudyListManager();