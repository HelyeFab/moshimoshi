/**
 * Migration script to fix localStorage user data isolation
 *
 * Run this script in the browser console or as part of the app initialization
 * to migrate existing non-user-specific localStorage data to user-specific keys
 */

// Legacy keys that need migration
const LEGACY_KEYS = [
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
  'kana-progress-hiragana',
  'kana-progress-katakana',
];

function getCurrentUserId() {
  try {
    const authData = localStorage.getItem('auth-user');
    if (authData) {
      const user = JSON.parse(authData);
      return user?.uid || null;
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }
  return null;
}

function migrateUserStorage() {
  console.log('🔄 Starting localStorage migration for user data isolation...');

  const userId = getCurrentUserId();

  if (!userId) {
    console.warn('⚠️ No user logged in. Migration will run when user logs in.');
    return {
      success: false,
      message: 'No user logged in',
    };
  }

  console.log(`👤 Migrating data for user: ${userId}`);

  const migrationKey = `moshimoshi_migration_v2_complete_${userId}`;

  // Check if already migrated
  if (localStorage.getItem(migrationKey) === 'true') {
    console.log('✅ Migration already completed for this user');
    return {
      success: true,
      message: 'Already migrated',
      userId,
    };
  }

  let migratedCount = 0;
  const migrationReport = {
    userId,
    migratedItems: [],
    errors: [],
  };

  // Migrate each legacy key
  LEGACY_KEYS.forEach(oldKey => {
    try {
      const oldValue = localStorage.getItem(oldKey);

      if (oldValue !== null) {
        // Create new user-specific key
        const newKey = `moshimoshi_${oldKey}_${userId}`;

        // Check if new key already exists
        const existingValue = localStorage.getItem(newKey);

        if (existingValue) {
          console.log(`⏭️ Skipping ${oldKey} - already has user-specific value`);
        } else {
          // Migrate the value
          localStorage.setItem(newKey, oldValue);
          console.log(`✅ Migrated: ${oldKey} → ${newKey}`);

          migrationReport.migratedItems.push({
            oldKey,
            newKey,
            size: oldValue.length,
          });

          migratedCount++;
        }

        // Remove the old key (comment out if you want to keep for backup)
        localStorage.removeItem(oldKey);
      }
    } catch (error) {
      console.error(`❌ Failed to migrate ${oldKey}:`, error);
      migrationReport.errors.push({
        key: oldKey,
        error: error.message,
      });
    }
  });

  // Handle special cases for study lists (already have some user isolation)
  try {
    // Old study lists key
    const oldListsKey = 'moshimoshi_study_lists';
    const oldListsData = localStorage.getItem(oldListsKey);

    if (oldListsData) {
      const lists = JSON.parse(oldListsData);
      // Filter to only this user's lists
      const userLists = lists.filter(list => list.userId === userId);

      if (userLists.length > 0) {
        const newKey = `moshimoshi_study_lists_${userId}`;
        localStorage.setItem(newKey, JSON.stringify(userLists));
        console.log(`✅ Migrated ${userLists.length} study lists`);
        migratedCount++;
      }

      localStorage.removeItem(oldListsKey);
    }

    // Old saved items key
    const oldItemsKey = 'moshimoshi_saved_study_items';
    const oldItemsData = localStorage.getItem(oldItemsKey);

    if (oldItemsData) {
      const items = JSON.parse(oldItemsData);
      // Filter to only this user's items
      const userItems = items.filter(item => item.userId === userId);

      if (userItems.length > 0) {
        const newKey = `moshimoshi_saved_study_items_${userId}`;
        localStorage.setItem(newKey, JSON.stringify(userItems));
        console.log(`✅ Migrated ${userItems.length} saved items`);
        migratedCount++;
      }

      localStorage.removeItem(oldItemsKey);
    }
  } catch (error) {
    console.error('Failed to migrate study lists:', error);
    migrationReport.errors.push({
      key: 'study_lists',
      error: error.message,
    });
  }

  // Mark migration as complete
  localStorage.setItem(migrationKey, 'true');
  localStorage.setItem(`${migrationKey}_date`, new Date().toISOString());
  localStorage.setItem(`${migrationKey}_report`, JSON.stringify(migrationReport));

  console.log(`
🎉 Migration completed!
📊 Summary:
   - User ID: ${userId}
   - Items migrated: ${migratedCount}
   - Errors: ${migrationReport.errors.length}
  `);

  return {
    success: true,
    userId,
    migratedCount,
    report: migrationReport,
  };
}

// Clean up orphaned data from other users
function cleanupOrphanedData() {
  const currentUserId = getCurrentUserId();

  if (!currentUserId) {
    console.warn('No user logged in, skipping orphaned data cleanup');
    return;
  }

  console.log('🧹 Cleaning up orphaned user data...');

  const keysToRemove = [];
  const userPattern = /_([a-zA-Z0-9]+)$/; // Matches user ID at end of key

  // Find all moshimoshi keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    if (key && key.startsWith('moshimoshi_')) {
      const match = key.match(userPattern);

      if (match && match[1] && match[1] !== currentUserId) {
        // This is data from a different user
        keysToRemove.push(key);
      }
    }
  }

  // Remove orphaned keys
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🗑️ Removed orphaned key: ${key}`);
  });

  console.log(`✅ Cleaned up ${keysToRemove.length} orphaned keys`);

  return {
    success: true,
    removedCount: keysToRemove.length,
    removedKeys: keysToRemove,
  };
}

// Verify migration status
function verifyMigration() {
  const userId = getCurrentUserId();

  if (!userId) {
    console.warn('No user logged in');
    return false;
  }

  console.log('🔍 Verifying migration status...');

  let hasLegacyKeys = false;
  let hasUserKeys = false;

  // Check for legacy keys
  LEGACY_KEYS.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      console.warn(`⚠️ Found legacy key: ${key}`);
      hasLegacyKeys = true;
    }
  });

  // Check for user-specific keys
  LEGACY_KEYS.forEach(key => {
    const userKey = `moshimoshi_${key}_${userId}`;
    if (localStorage.getItem(userKey) !== null) {
      hasUserKeys = true;
    }
  });

  const migrationKey = `moshimoshi_migration_v2_complete_${userId}`;
  const isMarkedComplete = localStorage.getItem(migrationKey) === 'true';

  console.log(`
📋 Verification Results:
   - Has legacy keys: ${hasLegacyKeys}
   - Has user keys: ${hasUserKeys}
   - Marked complete: ${isMarkedComplete}
   - Status: ${!hasLegacyKeys && hasUserKeys ? '✅ VERIFIED' : '❌ NEEDS MIGRATION'}
  `);

  return !hasLegacyKeys && hasUserKeys;
}

// Export for use in app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    migrateUserStorage,
    cleanupOrphanedData,
    verifyMigration,
  };
}

// Run migration if executed directly
if (typeof window !== 'undefined') {
  console.log('localStorage User Data Migration Tool');
  console.log('=====================================');
  console.log('Commands:');
  console.log('  migrateUserStorage() - Migrate current user data');
  console.log('  cleanupOrphanedData() - Remove data from other users');
  console.log('  verifyMigration() - Check migration status');
  console.log('');
  console.log('Run migrateUserStorage() to start migration');
}