const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeLegacyProgressField() {
  console.log('🔍 Searching for users with legacy progress field...\n');

  const usersSnapshot = await db.collection('users').get();

  let foundCount = 0;
  let removedCount = 0;
  const batch = db.batch();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();

    // Check if user has the legacy progress field
    if (userData.progress && typeof userData.progress === 'object') {
      foundCount++;

      console.log(`Found legacy progress in user: ${userDoc.id}`);
      console.log('  Data:', JSON.stringify(userData.progress, null, 2));

      // Check if user_stats has XP data
      const userStatsDoc = await db.collection('user_stats').doc(userDoc.id).get();
      if (userStatsDoc.exists) {
        const stats = userStatsDoc.data();
        console.log(`  ✅ user_stats exists with XP: ${stats?.xp?.total || 0}`);
      } else {
        console.log(`  ⚠️  No user_stats found for this user`);
      }

      // Remove the legacy progress field
      batch.update(userDoc.ref, {
        progress: admin.firestore.FieldValue.delete()
      });

      removedCount++;
      console.log('  ➡️  Queued for deletion\n');
    }
  }

  if (removedCount > 0) {
    console.log(`\n📝 Committing batch deletion of ${removedCount} legacy progress fields...`);
    await batch.commit();
    console.log('✅ Deletion complete!');
  } else {
    console.log('✅ No legacy progress fields found');
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Users checked: ${usersSnapshot.size}`);
  console.log(`   Legacy progress found: ${foundCount}`);
  console.log(`   Fields removed: ${removedCount}`);

  process.exit(0);
}

removeLegacyProgressField().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
