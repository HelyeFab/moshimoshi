const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function simulateAPI() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

  console.log('=== Simulating /api/flashcards/decks GET ===\n');

  try {
    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();

    console.log('Query succeeded!');
    console.log('Total decks returned:', snapshot.size);

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log('\nDeck ' + (index + 1) + ':');
      console.log('  id:', doc.id);
      console.log('  name:', data.name);
      console.log('  source:', data.source);
      console.log('  cardCount:', data.cardCount);
      console.log('  cards.length:', data.cards ? data.cards.length : 'undefined');
      console.log('  stats:', JSON.stringify(data.stats).slice(0, 100));
    });
  } catch (error) {
    console.error('Query FAILED:', error.message);
    if (error.code === 9) {
      console.error('MISSING INDEX - need to deploy indexes');
    }
  }
}

simulateAPI().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
