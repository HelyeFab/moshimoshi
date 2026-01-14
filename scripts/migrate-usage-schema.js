#!/usr/bin/env node

/**
 * Migrate usage docs from legacy { counts: { feature: n } } to top-level fields.
 *
 * Usage:
 *   node scripts/migrate-usage-schema.js <userId>
 *
 * Example:
 *   node scripts/migrate-usage-schema.js 5NNDhMn8wBXDQQ0aOFpR6M557ju1
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const userIdArg = process.argv[2] || null;

async function migrateUserUsage(userId) {
  console.log(`\nMigrating usage schema for user: ${userId}\n`);

  const usageSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('usage')
    .get();

  if (usageSnapshot.empty) {
    console.log('No usage documents found.');
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const doc of usageSnapshot.docs) {
    const data = doc.data();
    const counts = data?.counts;

    if (!counts || typeof counts !== 'object') {
      skipped += 1;
      continue;
    }

    const update = {};
    for (const [featureId, value] of Object.entries(counts)) {
      if (typeof value === 'number') {
        update[featureId] = value;
      }
    }

    update.lastUpdated = data.lastUpdated || data.updatedAt || new Date().toISOString();

    await doc.ref.set(update, { merge: true });
    await doc.ref.update({ counts: admin.firestore.FieldValue.delete() });
    migrated += 1;
  }

  console.log(`Done. Migrated: ${migrated}, Skipped: ${skipped}\n`);
}

async function migrateUsageSchema() {
  if (userIdArg) {
    await migrateUserUsage(userIdArg);
    return;
  }

  console.log('\nMigrating usage schema for all users...\n');
  const usersSnapshot = await db.collection('users').get();
  for (const userDoc of usersSnapshot.docs) {
    await migrateUserUsage(userDoc.id);
  }
}

migrateUsageSchema()
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await admin.app().delete();
  });
