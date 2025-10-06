#!/usr/bin/env node

/**
 * Migration Script: Flat to Nested Collection Structure
 *
 * Migrates three collections to nested structure under users/{userId}/:
 * 1. villageLayout/{userId} → users/{userId}/villageLayout/data
 * 2. pokemon/{userId} → users/{userId}/pokemon/data
 * 3. userVideoHistory/{userId} → users/{userId}/videoHistory/data
 *
 * This improves data organization, simplifies security rules, and makes
 * GDPR deletion easier (one delete deletes all user data).
 */

const admin = require('firebase-admin');

const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Collections to migrate
const MIGRATIONS = [
  {
    oldCollection: 'villageLayout',
    newPath: 'villageLayout',
    name: 'Village Layout',
    description: 'Learning village stall order customization'
  },
  {
    oldCollection: 'pokemon',
    newPath: 'pokemon',
    name: 'Pokémon Data',
    description: 'User Pokédex and caught Pokémon'
  },
  {
    oldCollection: 'userVideoHistory',
    newPath: 'videoHistory',
    name: 'Video History',
    description: 'YouTube video watch history'
  }
];

async function migrateCollection(migration) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Migrating: ${migration.name}`);
  console.log(`   ${migration.description}`);
  console.log(`   ${migration.oldCollection}/{userId} → users/{userId}/${migration.newPath}/data`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Get all documents from old collection
    const snapshot = await db.collection(migration.oldCollection).get();

    if (snapshot.empty) {
      console.log(`✅ No documents found in ${migration.oldCollection}`);
      console.log(`   Nothing to migrate!\n`);
      return {
        collection: migration.name,
        migrated: 0,
        errors: 0,
        skipped: 0
      };
    }

    console.log(`📊 Found ${snapshot.size} documents to migrate\n`);

    let migrated = 0;
    let errors = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      try {
        const userId = doc.id;
        const data = doc.data();

        // Check if already migrated
        const newDocRef = db.collection('users').doc(userId)
          .collection(migration.newPath).doc('data');
        const existingDoc = await newDocRef.get();

        if (existingDoc.exists) {
          console.log(`⏭️  Skipped ${userId} - already exists in new location`);
          skipped++;
          continue;
        }

        // Create document in new nested location
        await newDocRef.set({
          ...data,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          migratedFrom: migration.oldCollection
        });

        migrated++;
        console.log(`✅ Migrated ${userId}`);

      } catch (error) {
        console.error(`❌ Error migrating document ${doc.id}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 ${migration.name} Migration Summary:`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);

    return {
      collection: migration.name,
      migrated,
      errors,
      skipped
    };

  } catch (error) {
    console.error(`❌ ${migration.name} migration failed:`, error);
    return {
      collection: migration.name,
      migrated: 0,
      errors: 1,
      skipped: 0
    };
  }
}

async function runMigrations() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(12) + 'FIRESTORE COLLECTION MIGRATION' + ' '.repeat(16) + '║');
  console.log('║' + ' '.repeat(13) + 'Flat → Nested Structure' + ' '.repeat(22) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n');

  const results = [];

  for (const migration of MIGRATIONS) {
    const result = await migrateCollection(migration);
    results.push(result);
  }

  // Final summary
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(18) + 'FINAL SUMMARY' + ' '.repeat(27) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('\n');

  let totalMigrated = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  results.forEach(r => {
    console.log(`📦 ${r.collection}:`);
    console.log(`   ✅ Migrated: ${r.migrated}`);
    console.log(`   ⏭️  Skipped: ${r.skipped}`);
    console.log(`   ❌ Errors: ${r.errors}`);
    console.log('');

    totalMigrated += r.migrated;
    totalErrors += r.errors;
    totalSkipped += r.skipped;
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 TOTAL: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`);
  console.log(`${'='.repeat(60)}\n`);

  if (totalErrors === 0 && totalMigrated > 0) {
    console.log('✅ All migrations completed successfully!\n');
    console.log('⚠️  IMPORTANT NEXT STEPS:\n');
    console.log('1. Test the application thoroughly');
    console.log('2. Verify data in new locations via Firebase Console');
    console.log('3. Check users/{userId}/villageLayout/data');
    console.log('4. Check users/{userId}/pokemon/data');
    console.log('5. Check users/{userId}/videoHistory/data\n');
    console.log('6. Deploy updated Firestore security rules:');
    console.log('   firebase deploy --only firestore:rules\n');
    console.log('7. After 2-3 weeks of verification, manually delete old collections:');
    console.log('   - villageLayout');
    console.log('   - pokemon');
    console.log('   - userVideoHistory\n');
  } else if (totalErrors > 0) {
    console.log(`❌ Migration completed with ${totalErrors} error(s)`);
    console.log('   Please review errors above and retry if needed\n');
    process.exit(1);
  } else {
    console.log('✅ Migration complete (nothing to migrate)\n');
  }
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('🏁 Migration script finished\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
