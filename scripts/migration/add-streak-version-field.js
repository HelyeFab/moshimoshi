/**
 * Migration Script: Add Version Field to User Stats
 *
 * This script adds a 'version' field to all user_stats documents in Firebase.
 * This field is required for the new Firebase-first streak system to handle
 * conflict detection and resolution.
 *
 * IMPORTANT: This script MUST be run BEFORE deploying the new streak system code.
 *
 * Usage:
 *   node scripts/migration/add-streak-version-field.js [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be updated without making changes
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath)
  });
}

const db = admin.firestore();

// Configuration
const BATCH_SIZE = 500; // Firestore limit is 500 operations per batch
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Main migration function
 */
async function migrateVersionField() {
  console.log('='.repeat(60));
  console.log('Starting Version Field Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log('');

  try {
    // Get all user_stats documents
    console.log('Fetching all user_stats documents...');
    const snapshot = await db.collection('user_stats').get();

    const totalDocs = snapshot.size;
    console.log(`Found ${totalDocs} documents`);

    if (totalDocs === 0) {
      console.log('No documents to migrate. Exiting.');
      return;
    }

    // Filter documents that need the version field
    const docsToUpdate = [];
    const docsAlreadyMigrated = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.version === undefined || data.version === null) {
        docsToUpdate.push(doc.ref);
      } else {
        docsAlreadyMigrated.push(doc.id);
      }
    });

    console.log('');
    console.log('Migration Analysis:');
    console.log(`  Total documents: ${totalDocs}`);
    console.log(`  Already migrated: ${docsAlreadyMigrated.length}`);
    console.log(`  Need migration: ${docsToUpdate.length}`);
    console.log('');

    if (docsToUpdate.length === 0) {
      console.log('All documents already have version field. Nothing to do.');
      return;
    }

    if (DRY_RUN) {
      console.log('DRY RUN: Would update the following documents:');
      docsToUpdate.slice(0, 10).forEach(ref => {
        console.log(`  - ${ref.id}`);
      });
      if (docsToUpdate.length > 10) {
        console.log(`  ... and ${docsToUpdate.length - 10} more`);
      }
      console.log('');
      console.log('DRY RUN complete. Run without --dry-run to apply changes.');
      return;
    }

    // Process in batches
    console.log('Starting batch updates...');
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
      const batchDocs = docsToUpdate.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(docsToUpdate.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batchDocs.length} docs)...`);

      try {
        const batch = db.batch();

        for (const docRef of batchDocs) {
          batch.update(docRef, {
            version: 1,
            versionMigratedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        successCount += batchDocs.length;
        processedCount += batchDocs.length;

        console.log(`  ✓ Batch ${batchNumber} completed successfully`);
        console.log(`  Progress: ${processedCount}/${docsToUpdate.length} (${Math.round(processedCount / docsToUpdate.length * 100)}%)`);

      } catch (error) {
        errorCount += batchDocs.length;
        processedCount += batchDocs.length;
        errors.push({
          batch: batchNumber,
          error: error.message,
          docIds: batchDocs.map(ref => ref.id)
        });
        console.error(`  ✗ Batch ${batchNumber} failed: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      if (i + BATCH_SIZE < docsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final summary
    console.log('');
    console.log('='.repeat(60));
    console.log('Migration Complete');
    console.log('='.repeat(60));
    console.log(`Total documents processed: ${processedCount}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('');

    if (errors.length > 0) {
      console.log('Errors encountered:');
      errors.forEach(err => {
        console.log(`  Batch ${err.batch}: ${err.error}`);
        console.log(`    Affected docs: ${err.docIds.slice(0, 5).join(', ')}${err.docIds.length > 5 ? '...' : ''}`);
      });
      console.log('');
      console.log('Please review errors and retry if necessary.');
      process.exit(1);
    } else {
      console.log('✓ All documents successfully migrated!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Verify migration by checking a few user_stats documents');
      console.log('2. Deploy the new streak system code');
      console.log('3. Run the data migration script to sync IndexedDB to Firebase');
    }

  } catch (error) {
    console.error('');
    console.error('FATAL ERROR:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Verify migration (optional utility function)
 */
async function verifyMigration() {
  console.log('Verifying migration...');

  const snapshot = await db.collection('user_stats').limit(100).get();

  let withVersion = 0;
  let withoutVersion = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.version !== undefined && data.version !== null) {
      withVersion++;
    } else {
      withoutVersion++;
    }
  });

  console.log(`Sample verification (100 docs):`);
  console.log(`  With version field: ${withVersion}`);
  console.log(`  Without version field: ${withoutVersion}`);

  if (withoutVersion > 0) {
    console.log('⚠️  Some documents still missing version field');
  } else {
    console.log('✓ All sampled documents have version field');
  }
}

// Run migration
if (require.main === module) {
  migrateVersionField()
    .then(() => {
      console.log('');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { migrateVersionField, verifyMigration };
