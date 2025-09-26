/**
 * Account Cleanup Manager
 * Agent 3 - Data & Sync
 *
 * Handles secure deletion of user data on account deletion or logout
 */

import { idbClient } from './client';
import { firebaseSync } from './firebase-sync';
import { outboxManager } from './outbox';
import { DB_NAME } from './types';

export interface CleanupResult {
  success: boolean;
  clearedStores: string[];
  errors: string[];
  timestamp: number;
}

export class AccountCleanupManager {
  private static instance: AccountCleanupManager | null = null;
  private isCleaningUp: boolean = false;

  private constructor() {
    // Singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AccountCleanupManager {
    if (!AccountCleanupManager.instance) {
      AccountCleanupManager.instance = new AccountCleanupManager();
    }
    return AccountCleanupManager.instance;
  }

  /**
   * Initialize cleanup manager
   */
  initialize(): void {
    // Listen for account deletion events
    document.addEventListener('accountDeleted', (event: any) => {
      this.handleAccountDeletion(event.detail);
    });

    // Listen for logout events
    document.addEventListener('userLoggedOut', (event: any) => {
      const shouldClearData = event.detail?.clearLocalData ?? false;
      if (shouldClearData) {
        this.handleLogout();
      }
    });
  }

  /**
   * Handle account deletion
   * Clears all local and remote data
   */
  private async handleAccountDeletion(details: any): Promise<void> {
    console.log('[AccountCleanup] Account deletion initiated');

    const result = await this.performFullCleanup();

    // Notify completion
    document.dispatchEvent(
      new CustomEvent('accountCleanupComplete', {
        detail: result
      })
    );

    // Redirect to login or home
    if (result.success) {
      window.location.href = '/';
    }
  }

  /**
   * Handle logout
   * Optionally clears local data based on user preference
   */
  private async handleLogout(): Promise<void> {
    console.log('[AccountCleanup] Logout cleanup initiated');

    const result = await this.clearLocalData();

    // Notify completion
    document.dispatchEvent(
      new CustomEvent('logoutCleanupComplete', {
        detail: result
      })
    );
  }

  /**
   * Perform full cleanup (account deletion)
   */
  async performFullCleanup(): Promise<CleanupResult> {
    if (this.isCleaningUp) {
      return {
        success: false,
        clearedStores: [],
        errors: ['Cleanup already in progress'],
        timestamp: Date.now()
      };
    }

    this.isCleaningUp = true;

    const result: CleanupResult = {
      success: true,
      clearedStores: [],
      errors: [],
      timestamp: Date.now()
    };

    try {
      console.log('[AccountCleanup] Starting full cleanup...');

      // 1. Disable sync
      firebaseSync.disableAutoSync();

      // 2. Clear all IndexedDB data
      await this.clearIndexedDB(result);

      // 3. Clear localStorage
      this.clearLocalStorage(result);

      // 4. Clear sessionStorage
      this.clearSessionStorage(result);

      // 5. Unregister service worker
      await this.unregisterServiceWorker(result);

      // 6. Clear caches
      await this.clearCaches(result);

      // 7. Revoke notification permissions
      await this.revokeNotifications(result);

      console.log('[AccountCleanup] Full cleanup completed:', result);

    } catch (error) {
      console.error('[AccountCleanup] Cleanup failed:', error);
      result.success = false;
      result.errors.push(String(error));
    } finally {
      this.isCleaningUp = false;
    }

    return result;
  }

  /**
   * Clear local data only (for logout)
   */
  async clearLocalData(): Promise<CleanupResult> {
    if (this.isCleaningUp) {
      return {
        success: false,
        clearedStores: [],
        errors: ['Cleanup already in progress'],
        timestamp: Date.now()
      };
    }

    this.isCleaningUp = true;

    const result: CleanupResult = {
      success: true,
      clearedStores: [],
      errors: [],
      timestamp: Date.now()
    };

    try {
      console.log('[AccountCleanup] Clearing local data...');

      // 1. Disable sync
      firebaseSync.disableAutoSync();

      // 2. Clear all IndexedDB data
      await this.clearIndexedDB(result);

      // 3. Clear auth tokens from localStorage
      this.clearAuthData(result);

      console.log('[AccountCleanup] Local data cleared:', result);

    } catch (error) {
      console.error('[AccountCleanup] Clear local data failed:', error);
      result.success = false;
      result.errors.push(String(error));
    } finally {
      this.isCleaningUp = false;
    }

    return result;
  }

  /**
   * Clear all IndexedDB data
   */
  private async clearIndexedDB(result: CleanupResult): Promise<void> {
    try {
      // Clear all stores using the IDB client
      await idbClient.clearAllData();
      result.clearedStores.push('IndexedDB: all stores');

      // Also delete the entire database for complete cleanup
      await this.deleteDatabase(DB_NAME);
      result.clearedStores.push(`Database: ${DB_NAME}`);

    } catch (error) {
      console.error('[AccountCleanup] Failed to clear IndexedDB:', error);
      result.errors.push(`IndexedDB clear failed: ${error}`);
    }
  }

  /**
   * Delete entire IndexedDB database
   */
  private async deleteDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(name);

      deleteReq.onsuccess = () => {
        console.log(`[AccountCleanup] Database ${name} deleted`);
        resolve();
      };

      deleteReq.onerror = () => {
        console.error(`[AccountCleanup] Failed to delete database ${name}`);
        reject(deleteReq.error);
      };

      deleteReq.onblocked = () => {
        console.warn(`[AccountCleanup] Database ${name} delete blocked`);
        // Close connections and retry
        idbClient.close();
        setTimeout(() => resolve(), 100);
      };
    });
  }

  /**
   * Clear localStorage
   */
  private clearLocalStorage(result: CleanupResult): void {
    try {
      const keysToKeep = ['theme', 'locale']; // Keep user preferences
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      }

      result.clearedStores.push('localStorage');
      console.log('[AccountCleanup] localStorage cleared');

    } catch (error) {
      console.error('[AccountCleanup] Failed to clear localStorage:', error);
      result.errors.push(`localStorage clear failed: ${error}`);
    }
  }

  /**
   * Clear sessionStorage
   */
  private clearSessionStorage(result: CleanupResult): void {
    try {
      sessionStorage.clear();
      result.clearedStores.push('sessionStorage');
      console.log('[AccountCleanup] sessionStorage cleared');

    } catch (error) {
      console.error('[AccountCleanup] Failed to clear sessionStorage:', error);
      result.errors.push(`sessionStorage clear failed: ${error}`);
    }
  }

  /**
   * Clear auth-related data from localStorage
   */
  private clearAuthData(result: CleanupResult): void {
    try {
      const authKeys = [
        'auth_token',
        'refresh_token',
        'user_id',
        'session_id',
        'firebase_token'
      ];

      for (const key of authKeys) {
        localStorage.removeItem(key);
      }

      result.clearedStores.push('localStorage: auth data');
      console.log('[AccountCleanup] Auth data cleared');

    } catch (error) {
      console.error('[AccountCleanup] Failed to clear auth data:', error);
      result.errors.push(`Auth data clear failed: ${error}`);
    }
  }

  /**
   * Unregister service worker
   */
  private async unregisterServiceWorker(result: CleanupResult): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      for (const registration of registrations) {
        const success = await registration.unregister();
        if (success) {
          console.log('[AccountCleanup] Service worker unregistered');
          result.clearedStores.push('Service Worker');
        }
      }

    } catch (error) {
      console.error('[AccountCleanup] Failed to unregister service worker:', error);
      result.errors.push(`Service worker unregister failed: ${error}`);
    }
  }

  /**
   * Clear all caches
   */
  private async clearCaches(result: CleanupResult): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        const deleted = await caches.delete(cacheName);
        if (deleted) {
          console.log(`[AccountCleanup] Cache ${cacheName} deleted`);
          result.clearedStores.push(`Cache: ${cacheName}`);
        }
      }

    } catch (error) {
      console.error('[AccountCleanup] Failed to clear caches:', error);
      result.errors.push(`Cache clear failed: ${error}`);
    }
  }

  /**
   * Revoke notification permissions
   */
  private async revokeNotifications(result: CleanupResult): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    try {
      // Can't actually revoke permission, but can unsubscribe from push
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const success = await subscription.unsubscribe();
          if (success) {
            console.log('[AccountCleanup] Push subscription cancelled');
            result.clearedStores.push('Push Subscription');
          }
        }
      }

      // Clear notification settings from local storage
      localStorage.removeItem('notification_settings');

    } catch (error) {
      console.error('[AccountCleanup] Failed to handle notifications:', error);
      result.errors.push(`Notification cleanup failed: ${error}`);
    }
  }

  /**
   * Verify cleanup was successful
   */
  async verifyCleanup(): Promise<boolean> {
    try {
      // Check IndexedDB
      const databases = await indexedDB.databases?.() || [];
      const dbExists = databases.some(db => db.name === DB_NAME);

      if (dbExists) {
        console.warn('[AccountCleanup] Database still exists after cleanup');
        return false;
      }

      // Check service worker
      const registrations = await navigator.serviceWorker?.getRegistrations() || [];
      if (registrations.length > 0) {
        console.warn('[AccountCleanup] Service workers still registered');
        return false;
      }

      // Check caches
      const cacheNames = await caches?.keys() || [];
      if (cacheNames.length > 0) {
        console.warn('[AccountCleanup] Caches still exist');
        return false;
      }

      console.log('[AccountCleanup] Cleanup verified successfully');
      return true;

    } catch (error) {
      console.error('[AccountCleanup] Verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const accountCleanup = AccountCleanupManager.getInstance();