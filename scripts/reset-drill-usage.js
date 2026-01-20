const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, '../moshimoshi-service-account.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function resetDrillUsage() {
  const userId = 'Qiq1zxsbqLWiO0DsaRW82q7ZwJ52';

  console.log('Resetting conjugation_drill usage for user:', userId);
  console.log('');

  // Get all usage documents
  const usageSnapshot = await db
    .collection('users')
    .doc(userId)
    .collection('usage')
    .get();

  const docsToDelete = [];

  usageSnapshot.forEach(doc => {
    const docId = doc.id;
    const data = doc.data();

    // Check if this document contains conjugation_drill
    if (data.conjugation_drill !== undefined || docId.startsWith('conjugation_drill_')) {
      docsToDelete.push({
        id: docId,
        count: data.conjugation_drill || 0
      });
    }
  });

  if (docsToDelete.length === 0) {
    console.log('No conjugation_drill usage documents found.');
    return;
  }

  console.log(`Found ${docsToDelete.length} document(s) to delete:`);
  docsToDelete.forEach(doc => {
    console.log(`  - ${doc.id} (count: ${doc.count})`);
  });
  console.log('');

  // Delete the documents
  for (const doc of docsToDelete) {
    await db
      .collection('users')
      .doc(userId)
      .collection('usage')
      .doc(doc.id)
      .delete();
    console.log(`✅ Deleted: ${doc.id}`);
  }

  console.log('');
  console.log('✅ Conjugation drill usage reset complete!');
}

resetDrillUsage()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  });
