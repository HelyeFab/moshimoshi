/**
 * Cleanup Script: Remove Legacy streak.dates field from user_stats
 *
 * This script removes the orphaned `streak.dates` nested object that was
 * part of the old schema and should not exist in schema v2.
 *
 * Usage:
 *   node scripts/cleanup-user-stats-schema.js [userId]
 *
 * If userId is provided, only that user will be cleaned.
 * Otherwise, all users will be processed.
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });
}

const db = admin.firestore();

async function cleanupUserStats(userId) {
  console.log(`\n🔍 Checking user_stats for user: ${userId}`);

  try {
    const userStatsRef = db.collection('user_stats').doc(userId);
    const userStatsDoc = await userStatsRef.get();

    if (!userStatsDoc.exists) {
      console.log('   ⚠️  No user_stats document found');
      return { userId, status: 'not_found' };
    }

    const data = userStatsDoc.data();

    // Check if legacy streak.dates exists
    if (data.streak && data.streak.dates) {
      console.log('   ❌ Found legacy streak.dates field!');
      console.log('   📝 Legacy data:', JSON.stringify(data.streak.dates, null, 2));

      // Remove the nested dates field
      const updatedStreak = {
        current: data.streak.current || 0,
        best: data.streak.best || 0
      };

      await userStatsRef.update({
        'streak': updatedStreak
      });

      console.log('   ✅ Removed legacy streak.dates field');
      return { userId, status: 'cleaned', hadIssue: true };
    } else {
      console.log('   ✅ No legacy fields found - document is clean');
      return { userId, status: 'clean', hadIssue: false };
    }
  } catch (error) {
    console.error(`   ❌ Error cleaning ${userId}:`, error.message);
    return { userId, status: 'error', error: error.message };
  }
}

async function cleanupAllUsers() {
  console.log('🚀 Starting cleanup of all user_stats documents...\n');

  try {
    const snapshot = await db.collection('user_stats').get();
    console.log(`📊 Found ${snapshot.size} user_stats documents\n`);

    const results = {
      total: snapshot.size,
      cleaned: 0,
      clean: 0,
      errors: 0,
      notFound: 0
    };

    for (const doc of snapshot.docs) {
      const result = await cleanupUserStats(doc.id);

      if (result.status === 'cleaned') {
        results.cleaned++;
      } else if (result.status === 'clean') {
        results.clean++;
      } else if (result.status === 'error') {
        results.errors++;
      } else if (result.status === 'not_found') {
        results.notFound++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total documents processed: ${results.total}`);
    console.log(`✅ Cleaned (had legacy fields): ${results.cleaned}`);
    console.log(`✅ Already clean: ${results.clean}`);
    console.log(`❌ Errors: ${results.errors}`);
    console.log(`⚠️  Not found: ${results.notFound}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const targetUserId = process.argv[2];

  try {
    if (targetUserId) {
      // Clean specific user
      console.log(`🎯 Targeting specific user: ${targetUserId}\n`);
      const result = await cleanupUserStats(targetUserId);

      console.log('\n' + '='.repeat(60));
      console.log('✅ Cleanup complete!');
      console.log(`Status: ${result.status}`);
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log('='.repeat(60));
    } else {
      // Clean all users
      await cleanupAllUsers();
    }

    console.log('\n✅ Script completed successfully\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

main();
