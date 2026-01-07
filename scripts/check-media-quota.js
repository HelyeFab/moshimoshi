const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkQuota() {
  try {
    console.log('📊 Checking Media Quota...\n');

    // Query all media metadata entries using collectionGroup
    // (This is what the quota endpoint does)
    const mediaSnapshot = await db
      .collectionGroup('media')
      .where('userId', '==', userId)
      .get();

    console.log(`✅ Found ${mediaSnapshot.size} metadata entries\n`);

    let totalSize = 0;
    const byDeck = {};

    mediaSnapshot.forEach(doc => {
      const data = doc.data();
      const size = data.size || 0;
      const deckId = data.deckId || 'unknown';

      totalSize += size;

      if (!byDeck[deckId]) {
        byDeck[deckId] = { count: 0, size: 0 };
      }
      byDeck[deckId].count++;
      byDeck[deckId].size += size;
    });

    console.log('📦 By Deck:\n');
    Object.keys(byDeck).forEach(deckId => {
      const deck = byDeck[deckId];
      console.log(`  Deck: ${deckId}`);
      console.log(`  Files: ${deck.count}`);
      console.log(`  Size: ${(deck.size / 1024 / 1024).toFixed(2)} MB\n`);
    });

    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    const maxMB = 500;
    const percentUsed = ((totalSize / (maxMB * 1024 * 1024)) * 100).toFixed(1);

    console.log(`💾 Total Media Storage:`);
    console.log(`  Used: ${totalMB} MB / ${maxMB} MB (${percentUsed}%)`);
    console.log(`  Files: ${mediaSnapshot.size}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkQuota();
