const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkMetadata() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();
  
  if (snapshot.empty) {
    console.log('No Anki decks found');
    return;
  }
  
  const deck = snapshot.docs[0].data();
  console.log('=== Card Metadata Check ===');
  
  if (deck.cards && deck.cards[0]) {
    const card = deck.cards[0];
    console.log('card.metadata:', JSON.stringify(card.metadata, null, 2));
    console.log('\n--- Fields accessed by DeckGrid ---');
    console.log('card.metadata?.status:', card.metadata?.status);
    console.log('card.metadata?.nextReview:', card.metadata?.nextReview);
  }
  
  // Check what FlashcardManager expects
  console.log('\n=== Comparing with FlashcardDeck structure ===');
  console.log('Has stats.totalCards:', deck.stats?.totalCards);
  console.log('Has stats.averageAccuracy:', deck.stats?.averageAccuracy);
  console.log('Has stats.currentStreak:', deck.stats?.currentStreak);
  console.log('Has stats.masteredCards:', deck.stats?.masteredCards);
  console.log('Has stats.reviewCards:', deck.stats?.reviewCards);
}

checkMetadata().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
