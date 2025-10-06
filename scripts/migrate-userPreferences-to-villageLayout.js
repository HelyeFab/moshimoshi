#!/usr/bin/env node

/**
 * Migration Script: userPreferences → villageLayout
 *
 * This script migrates data from the old 'userPreferences' collection
 * to the new 'villageLayout' collection.
 *
 * The rename clarifies that this collection stores UI layout preferences
 * for the learning village, NOT general user preferences (theme, language, etc.)
 * which are now stored in users/{uid}.preferences
 */

const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function migrateCollection() {
  console.log('=====================================');
  console.log('🔄 Migrating userPreferences → villageLayout');
  console.log('=====================================\n');

  try {
    // Get all documents from userPreferences
    const snapshot = await db.collection('userPreferences').get();

    if (snapshot.empty) {
      console.log('✅ No documents found in userPreferences collection');
      console.log('   Nothing to migrate!');
      return;
    }

    console.log(`📊 Found ${snapshot.size} documents to migrate\n`);

    let migrated = 0;
    let errors = 0;

    // Use batch writes for efficiency
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const userId = doc.id;

        // Create document in new collection
        const newDocRef = db.collection('villageLayout').doc(userId);
        batch.set(newDocRef, {
          ...data,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedFrom: 'userPreferences'
        });

        batchCount++;

        // Commit batch if it reaches the limit
        if (batchCount >= batchSize) {
          await batch.commit();
          migrated += batchCount;
          console.log(`✅ Migrated batch: ${migrated}/${snapshot.size} documents`);
          batch = db.batch();
          batchCount = 0;
        }

      } catch (error) {
        console.error(`❌ Error migrating document ${doc.id}:`, error.message);
        errors++;
      }
    }

    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      migrated += batchCount;
    }

    console.log('\n=====================================');
    console.log('📊 Migration Summary');
    console.log('=====================================');
    console.log(`✅ Successfully migrated: ${migrated} documents`);
    console.log(`❌ Errors: ${errors} documents`);

    if (errors === 0 && migrated === snapshot.size) {
      console.log('\n⚠️  IMPORTANT: Review the villageLayout collection');
      console.log('   Once verified, you can manually delete the old');
      console.log('   userPreferences collection from Firebase Console');
      console.log('\n   DO NOT delete userPreferences until you verify');
      console.log('   all data is correctly in villageLayout!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateCollection()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
