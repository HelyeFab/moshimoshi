const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function main() {
  // Find ALL decks for user
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`Found ${snapshot.size} decks in Firebase`);

  if (snapshot.size === 0) {
    console.log('No decks to delete from Firebase');
  } else {
    // Delete all decks
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  Deleting: ${data.name} (${data.source || 'manual'})`);
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`\nDeleted ${snapshot.size} decks from Firebase`);
  }

  console.log('\n⚠️  IMPORTANT: You also need to clear your browser\'s IndexedDB:');
  console.log('   1. Open DevTools (F12)');
  console.log('   2. Go to Application tab');
  console.log('   3. Expand IndexedDB in the left sidebar');
  console.log('   4. Delete BOTH databases:');
  console.log('      - FlashcardDB (main deck storage)');
  console.log('      - FlashcardSyncDB (sync queue - THIS IS THE PROBLEM!)');
  console.log('   5. Refresh the page');
  console.log('\nThe sync queue keeps re-creating deleted decks!');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
