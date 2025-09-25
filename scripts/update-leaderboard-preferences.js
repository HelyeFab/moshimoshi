/**
 * Script to update all existing users with leaderboard privacy preference
 * Sets hideFromLeaderboard to false (opt-out model) for all users who don't have it set
 *
 * Usage: node scripts/update-leaderboard-preferences.js [--dry-run]
 */

const admin = require('firebase-admin');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Initialize Firebase Admin with service account
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
}

const db = admin.firestore();

async function updateUserPreferences() {
  console.log('=== Updating Leaderboard Preferences for All Users ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
  console.log('Setting: hideFromLeaderboard = false (users shown on leaderboard by default)\n');

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} total users\n`);

    let processed = 0;
    let updated = 0;
    let alreadySet = 0;
    let errors = 0;

    // Process in batches for better performance
    const batch = db.batch();
    const batchSize = 500;
    let batchCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      processed++;
      const userId = userDoc.id;
      const userData = userDoc.data();

      try {
        // Check if preferences already exist
        const preferencesRef = db
          .collection('users')
          .doc(userId)
          .collection('preferences')
          .doc('settings');

        const preferencesDoc = await preferencesRef.get();
        const existingPreferences = preferencesDoc.data() || {};

        // Check if hideFromLeaderboard is already set
        if (existingPreferences.hideFromLeaderboard !== undefined) {
          alreadySet++;
          console.log(`[${processed}/${usersSnapshot.size}] User ${userId} (${userData.displayName || 'Anonymous'}) - Already has preference: ${existingPreferences.hideFromLeaderboard}`);
          continue;
        }

        // Update preferences with default value (false = shown on leaderboard)
        const updatedPreferences = {
          ...existingPreferences,
          hideFromLeaderboard: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (isDryRun) {
          console.log(`[${processed}/${usersSnapshot.size}] User ${userId} (${userData.displayName || 'Anonymous'}) - Would set hideFromLeaderboard: false`);
          updated++;
        } else {
          // Add to batch
          batch.set(preferencesRef, updatedPreferences, { merge: true });
          batchCount++;
          updated++;

          console.log(`[${processed}/${usersSnapshot.size}] User ${userId} (${userData.displayName || 'Anonymous'}) - Setting hideFromLeaderboard: false`);

          // Commit batch when it reaches the size limit
          if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`  ✓ Committed batch of ${batchSize} updates`);
            batchCount = 0;
            // Create new batch for next set
            batch = db.batch();
          }
        }

        // Add small delay to avoid overwhelming the system
        if (processed % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        errors++;
        console.error(`[${processed}/${usersSnapshot.size}] Error processing user ${userId}:`, error.message);
      }
    }

    // Commit remaining batch updates
    if (!isDryRun && batchCount > 0) {
      await batch.commit();
      console.log(`  ✓ Committed final batch of ${batchCount} updates`);
    }

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Total users processed: ${processed}`);
    console.log(`Users updated: ${updated}`);
    console.log(`Users already had preference: ${alreadySet}`);
    console.log(`Errors: ${errors}`);

    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('Run without --dry-run flag to apply changes');
    } else {
      console.log('\n✅ Leaderboard preferences updated successfully!');
      console.log('All users without a preference are now set to appear on the leaderboard');
    }

    // Show some stats about current preferences
    if (!isDryRun) {
      console.log('\n=== Current Leaderboard Stats ===');

      // Count users by preference
      let visibleCount = 0;
      let hiddenCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const preferencesDoc = await db
          .collection('users')
          .doc(userDoc.id)
          .collection('preferences')
          .doc('settings')
          .get();

        const prefs = preferencesDoc.data() || {};

        if (prefs.hideFromLeaderboard === true) {
          hiddenCount++;
        } else {
          visibleCount++;
        }
      }

      console.log(`Users visible on leaderboard: ${visibleCount}`);
      console.log(`Users hidden from leaderboard: ${hiddenCount}`);
      console.log(`Visibility percentage: ${((visibleCount / usersSnapshot.size) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the update
updateUserPreferences();