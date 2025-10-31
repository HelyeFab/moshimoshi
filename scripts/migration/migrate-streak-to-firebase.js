/**
 * Migration Script: Migrate Streak Data from IndexedDB to Firebase
 *
 * This script migrates user streak data from IndexedDB (old system) to Firebase (new system).
 * It preserves the maximum values to prevent data loss.
 *
 * IMPORTANT:
 * - This script should be run AFTER deploying the new code with version field migration
 * - This is a CLIENT-SIDE script that runs in the browser
 * - Users should run this via a special migration page
 *
 * Usage:
 *   Include this script in a migration page and call migrateStreakData()
 */

/**
 * Open IndexedDB and read gamification data
 */
async function readIndexedDBData() {
  return new Promise((resolve, reject) => {
    const dbName = 'moshimoshi_gamification';
    const storeName = 'gamification';

    const request = indexedDB.open(dbName, 1);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(storeName)) {
        // No data to migrate
        resolve(null);
        return;
      }

      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const data = getAllRequest.result;
        db.close();

        if (data && data.length > 0) {
          // Return first record (should only be one per user)
          resolve(data[0]);
        } else {
          resolve(null);
        }
      };

      getAllRequest.onerror = () => {
        db.close();
        reject(new Error('Failed to read from IndexedDB'));
      };
    };
  });
}

/**
 * Upload streak data to Firebase via API
 */
async function uploadToFirebase(data) {
  const response = await fetch('/api/gamification/migration/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentStreak: data.currentStreak || 0,
      bestStreak: data.bestStreak || 0,
      lastActivityDate: data.lastActivityDate,
      totalXP: data.totalXP || 0,
      unlockedAchievements: data.unlockedAchievements || [],
      achievementProgress: data.achievementProgress || {},
      sessionCount: data.sessionCount || 0
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to upload to Firebase');
  }

  return response.json();
}

/**
 * Main migration function
 */
async function migrateStreakData() {
  const result = {
    success: false,
    message: '',
    data: null,
    errors: []
  };

  try {
    console.log('[Migration] Starting streak data migration from IndexedDB to Firebase');

    // Step 1: Check if user is authenticated
    const authResponse = await fetch('/api/auth/session');
    if (!authResponse.ok) {
      throw new Error('User not authenticated. Please log in and try again.');
    }

    const session = await authResponse.json();
    if (!session || !session.userId) {
      throw new Error('No active session found. Please log in and try again.');
    }

    console.log('[Migration] User authenticated:', session.userId);

    // Step 2: Read data from IndexedDB
    console.log('[Migration] Reading data from IndexedDB...');
    const indexedDBData = await readIndexedDBData();

    if (!indexedDBData) {
      result.success = true;
      result.message = 'No IndexedDB data found. Nothing to migrate.';
      console.log('[Migration]', result.message);
      return result;
    }

    console.log('[Migration] Found IndexedDB data:', {
      currentStreak: indexedDBData.currentStreak,
      bestStreak: indexedDBData.bestStreak,
      totalXP: indexedDBData.totalXP,
      sessionCount: indexedDBData.sessionCount
    });

    // Step 3: Upload to Firebase
    console.log('[Migration] Uploading to Firebase...');
    const uploadResult = await uploadToFirebase(indexedDBData);

    console.log('[Migration] Upload result:', uploadResult);

    // Step 4: Verify migration
    if (uploadResult.success) {
      result.success = true;
      result.message = 'Successfully migrated streak data to Firebase!';
      result.data = uploadResult.data;

      // Show comparison
      console.log('[Migration] Migration successful!');
      console.log('[Migration] Before (IndexedDB):', {
        currentStreak: indexedDBData.currentStreak,
        bestStreak: indexedDBData.bestStreak,
        totalXP: indexedDBData.totalXP
      });
      console.log('[Migration] After (Firebase):', {
        currentStreak: result.data.currentStreak,
        bestStreak: result.data.bestStreak,
        totalXP: result.data.totalXP
      });

      // Note: We keep IndexedDB data for rollback purposes
      // It will be cleaned up in Phase 4 of the migration plan

    } else {
      throw new Error(uploadResult.error || 'Unknown error during upload');
    }

  } catch (error) {
    console.error('[Migration] Error:', error);
    result.success = false;
    result.message = error.message;
    result.errors.push({
      step: 'migration',
      error: error.message
    });
  }

  return result;
}

/**
 * Check migration status
 */
async function checkMigrationStatus() {
  try {
    const response = await fetch('/api/gamification/migration/status');
    if (!response.ok) {
      throw new Error('Failed to check migration status');
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('[Migration] Failed to check status:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in React component
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    migrateStreakData,
    checkMigrationStatus
  };
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.migrateStreakData = migrateStreakData;
  window.checkMigrationStatus = checkMigrationStatus;
}
