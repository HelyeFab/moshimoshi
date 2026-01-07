const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkSubcollections() {
  try {
    console.log('🔍 Checking media subcollections...\n');

    // Check if deck "1" document exists (from the first file path)
    const deckRef = db.collection('users').doc(userId).collection('ankiDecks').doc('1');
    const deckDoc = await deckRef.get();

    console.log(`Deck document exists: ${deckDoc.exists}`);

    if (deckDoc.exists) {
      console.log(`Deck data:`, deckDoc.data());
    }

    console.log('\nChecking media subcollection under deck "1"...\n');

    // Check media subcollection (can exist even if parent doesn't)
    const mediaSnapshot = await deckRef.collection('media').limit(5).get();

    console.log(`Media subcollection size: ${mediaSnapshot.size}\n`);

    if (!mediaSnapshot.empty) {
      console.log('Sample media documents:');
      mediaSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}`);
        console.log(`    Size: ${(data.size / 1024).toFixed(2)} KB`);
        console.log(`    Sync Status: ${data.syncStatus}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkSubcollections();
