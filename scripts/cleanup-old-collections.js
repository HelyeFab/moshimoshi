#!/usr/bin/env node

/**
 * Cleanup Script for Old Collections
 *
 * Removes old scattered collections after successful migration to unified stats.
 * Only deletes if user_stats exists and is healthy.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function cleanupUserCollections(userId, dryRun = true) {
  console.log('\n=====================================');
  console.log(`🧹 Cleanup for User: ${userId}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}`);
  console.log('=====================================\n');

  try {
    // 1. First verify user_stats exists and is healthy
    console.log('✅ Verifying user_stats collection...');
    const userStatsDoc = await db.collection('user_stats').doc(userId).get();

    if (!userStatsDoc.exists) {
      console.error('❌ user_stats document NOT found - aborting cleanup');
      return false;
    }

    const stats = userStatsDoc.data();
    if (stats.metadata?.dataHealth !== 'healthy') {
      console.error(`❌ user_stats health is ${stats.metadata?.dataHealth} - aborting cleanup`);
      return false;
    }

    console.log('  ✅ user_stats exists and is healthy');
    console.log(`  📊 Streak: ${stats.streak?.current || 0}`);
    console.log(`  ⭐ XP: ${stats.xp?.total || 0}`);
    console.log(`  🏆 Achievements: ${stats.achievements?.unlockedCount || 0}`);

    // 2. Clean up old collections
    const collectionsToDelete = [
      {
        name: 'leaderboard_stats',
        ref: db.collection('leaderboard_stats').doc(userId)
      },
      {
        name: 'achievements/data',
        ref: db.collection('users').doc(userId).collection('achievements').doc('data')
      },
      {
        name: 'achievements/activities',
        ref: db.collection('users').doc(userId).collection('achievements').doc('activities')
      },
      {
        name: 'statistics/overall',
        ref: db.collection('users').doc(userId).collection('statistics').doc('overall')
      }
    ];

    console.log('\n🗑️ Cleaning up old collections...');
    let deletedCount = 0;

    for (const col of collectionsToDelete) {
      const doc = await col.ref.get();
      if (doc.exists) {
        if (dryRun) {
          console.log(`  📋 Would delete: ${col.name}`);
        } else {
          await col.ref.delete();
          console.log(`  ✅ Deleted: ${col.name}`);
        }
        deletedCount++;
      } else {
        console.log(`  ⏭️  Already gone: ${col.name}`);
      }
    }

    // 3. Summary
    console.log('\n=====================================');
    console.log('📊 Cleanup Summary');
    console.log('=====================================\n');

    if (dryRun) {
      console.log(`Would delete ${deletedCount} old collections`);
      console.log('\n💡 Run with --execute flag to perform actual deletion');
    } else {
      console.log(`✅ Deleted ${deletedCount} old collections`);
      console.log('✅ User data is now fully migrated to user_stats');
    }

    return true;

  } catch (error) {
    console.error('\n❌ Cleanup error:', error);
    return false;
  }
}

async function cleanupAllUsers(dryRun = true) {
  console.log('\n=====================================');
  console.log('🧹 Cleaning up ALL users');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('=====================================\n');

  try {
    // Get all users with user_stats
    const userStatsSnapshot = await db.collection('user_stats').get();

    console.log(`Found ${userStatsSnapshot.size} users with user_stats`);

    let successCount = 0;
    let failureCount = 0;

    for (const doc of userStatsSnapshot.docs) {
      const userId = doc.id;
      const success = await cleanupUserCollections(userId, dryRun);

      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n=====================================');
    console.log('🎉 Cleanup Complete');
    console.log('=====================================\n');
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Failed: ${failureCount} users`);

    if (dryRun) {
      console.log('\n💡 Run with --execute flag to perform actual deletion');
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const userId = args.find(arg => !arg.startsWith('--'));
const isExecute = args.includes('--execute');
const isAllUsers = args.includes('--all');

// Run cleanup
if (isAllUsers) {
  cleanupAllUsers(!isExecute)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else if (userId) {
  cleanupUserCollections(userId, !isExecute)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} else {
  console.log('Usage:');
  console.log('  Dry run for single user:  node cleanup-old-collections.js [userId]');
  console.log('  Execute for single user:  node cleanup-old-collections.js [userId] --execute');
  console.log('  Dry run for all users:    node cleanup-old-collections.js --all');
  console.log('  Execute for all users:    node cleanup-old-collections.js --all --execute');
  process.exit(0);
}