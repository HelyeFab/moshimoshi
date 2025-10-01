const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Check if already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateProgressToUserStats() {
  console.log('🔄 Migrating /users/{uid}/progress to /user_stats/{uid}/progress...\n');

  const usersSnapshot = await db.collection('users').get();

  let totalUsers = 0;
  let usersWithProgress = 0;
  let totalDocsMigrated = 0;
  let errors = [];

  for (const userDoc of usersSnapshot.docs) {
    totalUsers++;
    const userId = userDoc.id;

    try {
      // Check if user has progress subcollection
      const progressSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('progress')
        .get();

      if (progressSnapshot.empty) {
        continue;
      }

      usersWithProgress++;
      console.log(`\n📦 User: ${userId}`);
      console.log(`   Found ${progressSnapshot.size} progress documents`);

      // Copy each document to user_stats
      const batch = db.batch();
      let batchCount = 0;

      for (const progressDoc of progressSnapshot.docs) {
        const sourceRef = db
          .collection('users')
          .doc(userId)
          .collection('progress')
          .doc(progressDoc.id);

        const targetRef = db
          .collection('user_stats')
          .doc(userId)
          .collection('progress')
          .doc(progressDoc.id);

        const data = progressDoc.data();

        // Add migration metadata
        const migratedData = {
          ...data,
          migratedFrom: `/users/${userId}/progress/${progressDoc.id}`,
          migratedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        batch.set(targetRef, migratedData);
        batchCount++;
        totalDocsMigrated++;

        console.log(`   ✅ Queued: ${progressDoc.id}`);

        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} documents`);
          batchCount = 0;
        }
      }

      // Commit remaining documents
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} documents`);
      }

      console.log(`   ✅ Migration complete for user ${userId}`);

    } catch (error) {
      console.error(`   ❌ Error migrating user ${userId}:`, error.message);
      errors.push({ userId, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`Total users checked: ${totalUsers}`);
  console.log(`Users with progress data: ${usersWithProgress}`);
  console.log(`Total documents migrated: ${totalDocsMigrated}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(({ userId, error }) => {
      console.log(`   - User ${userId}: ${error}`);
    });
  }

  console.log('\n✅ Migration complete!');
  console.log('⚠️  IMPORTANT: Old data in /users/{uid}/progress is still present');
  console.log('   Review the migrated data before deleting old collection');

  process.exit(0);
}

migrateProgressToUserStats().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
