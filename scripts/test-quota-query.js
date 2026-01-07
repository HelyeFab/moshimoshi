const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function testQuotaQuery() {
  try {
    console.log('💾 Testing quota calculation query...\n');

    // This is the EXACT query the quota endpoint uses
    const mediaSnapshot = await db
      .collectionGroup('media')
      .where('userId', '==', userId)
      .get();

    console.log(`✅ Query successful!`);
    console.log(`Found ${mediaSnapshot.size} media files\n`);

    let totalSize = 0;
    const byDeck = {};

    mediaSnapshot.forEach(doc => {
      const data = doc.data();
      totalSize += data.size || 0;

      const deckId = data.deckId || 'unknown';
      if (!byDeck[deckId]) {
        byDeck[deckId] = { count: 0, size: 0 };
      }
      byDeck[deckId].count++;
      byDeck[deckId].size += data.size || 0;
    });

    console.log('📦 By Deck:\n');
    Object.keys(byDeck).forEach(deckId => {
      const deck = byDeck[deckId];
      console.log(`  Deck ${deckId}: ${deck.count} files, ${(deck.size / 1024 / 1024).toFixed(2)} MB`);
    });

    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    const maxMB = 500;
    const percentUsed = ((totalSize / (maxMB * 1024 * 1024)) * 100).toFixed(1);

    console.log(`\n💾 Total Media Storage:`);
    console.log(`  Used: ${totalMB} MB / ${maxMB} MB (${percentUsed}%)`);
    console.log(`  Files: ${mediaSnapshot.size}`);

    console.log(`\n✅ Quota badge should now show: ${totalMB} MB / ${maxMB} MB`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('FAILED_PRECONDITION')) {
      console.log('\n⚠️  Index is missing or still building');
      console.log('Solution: The index will auto-create on first use from your app');
      console.log('Wait a few minutes and try refreshing the page');
    }
    console.error(error.stack);
  }

  process.exit(0);
}

testQuotaQuery();
