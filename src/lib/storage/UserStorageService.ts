/**
 * User-specific storage service
 * Automatically handles user-specific keys to prevent data leakage between users
 *
 * SECURITY: This service ensures all localStorage keys are user-specific
 * to prevent data sharing between users on the same browser
 */

export class UserStorageService {
  private userId: string | null = null;
  private readonly prefix = 'moshimoshi';

  /**
   * Initialize the service with a user ID
   * @param userId - The current user's ID (use 'guest' for non-authenticated users)
   */
  constructor(userId?: string | null) {
    this.userId = userId || this.getUserIdFromAuth();
  }

  /**
   * Try to get user ID from auth storage
   */
  private getUserIdFromAuth(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const authData = localStorage.getItem('auth-user');
      if (authData) {
        const user = JSON.parse(authData);
        return user?.uid || null;
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Set the current user ID
   */
  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Generate a user-specific key
   */
  private getUserKey(key: string): string {
    const uid = this.userId || 'guest';
    return `${this.prefix}_${key}_${uid}`;
  }

  /**
   * Set an item in localStorage with user-specific key
   */
  setItem(key: string, value: any): void {
    if (typeof window === 'undefined') return;

    const userKey = this.getUserKey(key);
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    try {
      localStorage.setItem(userKey, serialized);
    } catch (error) {
      console.error(`[UserStorage] Failed to set ${key}:`, error);
    }
  }

  /**
   * Get an item from localStorage with user-specific key
   */
  getItem<T = any>(key: string, defaultValue?: T): T | null {
    if (typeof window === 'undefined') return defaultValue || null;

    const userKey = this.getUserKey(key);

    try {
      const item = localStorage.getItem(userKey);
      if (!item) return defaultValue || null;

      try {
        return JSON.parse(item) as T;
      } catch {
        // If not JSON, return as string
        return item as any;
      }
    } catch (error) {
      console.error(`[UserStorage] Failed to get ${key}:`, error);
      return defaultValue || null;
    }
  }

  /**
   * Remove an item from localStorage
   */
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;

    const userKey = this.getUserKey(key);

    try {
      localStorage.removeItem(userKey);
    } catch (error) {
      console.error(`[UserStorage] Failed to remove ${key}:`, error);
    }
  }

  /**
   * Clear all items for the current user
   */
  clearUserData(): void {
    if (typeof window === 'undefined') return;

    const uid = this.userId || 'guest';
    const pattern = new RegExp(`^${this.prefix}_.*_${uid}$`);

    const keysToRemove: string[] = [];

    // Find all keys for this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && pattern.test(key)) {
        keysToRemove.push(key);
      }
    }

    // Remove them
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });

    console.log(`[UserStorage] Cleared ${keysToRemove.length} items for user ${uid}`);
  }

  /**
   * Migrate old non-user-specific data to user-specific keys
   */
  migrateOldData(oldKeys: string[]): void {
    if (typeof window === 'undefined' || !this.userId) return;

    const migrationKey = `${this.prefix}_migration_complete_${this.userId}`;

    // Check if already migrated
    if (localStorage.getItem(migrationKey)) return;

    let migratedCount = 0;

    oldKeys.forEach(oldKey => {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue) {
        // Save with new user-specific key
        const newKey = oldKey.replace(/^moshimoshi_/, '').replace(/_$/, '');
        this.setItem(newKey, oldValue);

        // Remove old key
        localStorage.removeItem(oldKey);
        migratedCount++;
      }
    });

    // Mark as migrated
    localStorage.setItem(migrationKey, 'true');

    if (migratedCount > 0) {
      console.log(`[UserStorage] Migrated ${migratedCount} items to user-specific keys`);
    }
  }

  /**
   * Get all keys for the current user
   */
  getUserKeys(): string[] {
    if (typeof window === 'undefined') return [];

    const uid = this.userId || 'guest';
    const pattern = new RegExp(`^${this.prefix}_(.*)_${uid}$`);
    const userKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && pattern.test(key)) {
        // Extract the original key name
        const match = key.match(pattern);
        if (match && match[1]) {
          userKeys.push(match[1]);
        }
      }
    }

    return userKeys;
  }

  /**
   * Check if a key exists for the current user
   */
  hasItem(key: string): boolean {
    if (typeof window === 'undefined') return false;

    const userKey = this.getUserKey(key);
    return localStorage.getItem(userKey) !== null;
  }

  /**
   * Get storage size for the current user (approximate)
   */
  getUserStorageSize(): number {
    if (typeof window === 'undefined') return 0;

    const uid = this.userId || 'guest';
    const pattern = new RegExp(`^${this.prefix}_.*_${uid}$`);
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && pattern.test(key)) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }

    return totalSize;
  }
}

// Singleton instance for global usage
let globalInstance: UserStorageService | null = null;

/**
 * Get the global UserStorageService instance
 */
export function getUserStorage(): UserStorageService {
  if (!globalInstance) {
    globalInstance = new UserStorageService();
  }
  return globalInstance;
}

/**
 * Create a new UserStorageService instance for a specific user
 */
export function createUserStorage(userId: string | null): UserStorageService {
  return new UserStorageService(userId);
}

/**
 * React hook for using UserStorageService
 */
export function useUserStorage(userId?: string | null): UserStorageService {
  const storage = new UserStorageService(userId);
  return storage;
}

/**
 * List of legacy keys that need migration
 */
export const LEGACY_STORAGE_KEYS = [
  'lastReviewDate',
  'currentStreak',
  'bestStreak',
  'kana-progress',
  'kanjiMasteryProgress',
  'kanjiReviewStats',
  'kanjiMasterySettings',
  'review_countdowns',
  'learningVillageState',
  'emailForSignIn',
  'vocab_search_source',
  'wanikani_cache_populated',
  'dashboard_visited',
  'scheduled_notifications',
  'moshimoshi_study_lists',  // Legacy study list keys
  'moshimoshi_saved_items',
  'moshimoshi_saved_study_items',
  'user-preferences',  // Old preferences key
  'kana-progress-hiragana',
  'kana-progress-katakana',
];