const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkAPIResponse() {
  const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
  
  // This is exactly what /api/flashcards/decks does
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .get();
  
  console.log('Decks found:', snapshot.size);
  
  snapshot.docs.forEach((doc, i) => {
    const data = doc.data();
    console.log('\nDeck', i + 1, ':');
    console.log('  name:', data.name);
    console.log('  source:', data.source);
    console.log('  cards array exists:', !!data.cards);
    console.log('  cards.length:', data.cards ? data.cards.length : 'N/A');
    console.log('  cardCount field:', data.cardCount);
  });
}

checkAPIResponse().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
