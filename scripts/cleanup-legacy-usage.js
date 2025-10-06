#!/usr/bin/env node

/**
 * Cleanup Script: Remove Legacy Usage Data
 *
 * Deletes orphaned flat usage/{userId} documents that used the old
 * storage pattern before migration to users/{userId}/usage/
 *
 * SAFE TO RUN: Only deletes root-level usage/ collection documents.
 * Does NOT touch the new nested users/{userId}/usage/ subcollections.
 */

const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function cleanupLegacyUsage() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'LEGACY USAGE CLEANUP' + ' '.repeat(22) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  try {
    // Get all documents from the OLD root-level usage/ collection
    console.log('🔍 Scanning root-level usage/ collection...\n');
    const snapshot = await db.collection('usage').get();

    if (snapshot.empty) {
      console.log('✅ No legacy usage documents found');
      console.log('   Collection is already clean!\n');
      return {
        deleted: 0,
        errors: 0
      };
    }

    console.log(`📊 Found ${snapshot.size} legacy documents\n`);

    let deleted = 0;
    let errors = 0;
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;

    for (const doc of snapshot.docs) {
      try {
        const userId = doc.id;
        const data = doc.data();

        console.log(`🗑️  Deleting legacy usage for user: ${userId.substring(0, 15)}...`);
        console.log(`   Data: ${JSON.stringify(data).substring(0, 80)}...`);

        batch.delete(doc.ref);
        batchCount++;

        // Commit batch if limit reached
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          deleted += batchCount;
          console.log(`✅ Batch committed: ${deleted} documents deleted so far\n`);
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Error deleting ${doc.id}:`, error.message);
        errors++;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      deleted += batchCount;
    }

    console.log('\n╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(22) + 'SUMMARY' + ' '.repeat(29) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');
    console.log(`✅ Deleted: ${deleted} legacy documents`);
    console.log(`❌ Errors: ${errors}\n`);

    if (errors === 0) {
      console.log('✅ Cleanup completed successfully!');
      console.log('   All legacy usage/{userId} documents removed\n');
      console.log('⚠️  NOTE: New nested structure users/{userId}/usage/ preserved\n');
    } else {
      console.log(`⚠️  Cleanup completed with ${errors} error(s)\n`);
    }

    return {
      deleted,
      errors
    };

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Verification function
async function verifyNewStructure() {
  console.log('🔍 Verifying new nested structure...\n');

  try {
    const users = await db.collection('users').limit(3).get();
    let foundNested = 0;

    for (const userDoc of users.docs) {
      const usageSnapshot = await userDoc.ref.collection('usage').limit(1).get();
      if (!usageSnapshot.empty) {
        foundNested++;
        console.log(`✅ Found nested usage for: ${userDoc.id.substring(0, 15)}...`);
      }
    }

    if (foundNested > 0) {
      console.log(`\n✅ Nested structure verified: ${foundNested} users have usage/ subcollection\n`);
    } else {
      console.log('\n⚠️  No nested usage data found yet (this is OK if no usage has been tracked)\n');
    }

  } catch (error) {
    console.error('Error verifying structure:', error);
  }
}

// Run cleanup
console.log('Starting cleanup process...\n');

cleanupLegacyUsage()
  .then(async (result) => {
    if (result.deleted > 0) {
      console.log('═'.repeat(60));
      await verifyNewStructure();
    }

    console.log('🏁 Cleanup script finished\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
