const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStructure() {
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
  console.log('=== Anki Deck Structure ===');
  console.log('Top-level keys:', Object.keys(deck));
  console.log('\n--- Stats ---');
  console.log('stats:', JSON.stringify(deck.stats, null, 2));
  console.log('\n--- Settings ---');
  console.log('settings:', JSON.stringify(deck.settings, null, 2));
  console.log('\n--- First Card Structure ---');
  if (deck.cards && deck.cards[0]) {
    const card = deck.cards[0];
    console.log('Card keys:', Object.keys(card));
    console.log('front type:', typeof card.front);
    console.log('back type:', typeof card.back);
    console.log('Sample card:', JSON.stringify(card, null, 2).slice(0, 800));
  }
  console.log('\n--- Required FlashcardDeck fields ---');
  console.log('cardStyle:', deck.cardStyle);
  console.log('emoji:', deck.emoji);
  console.log('color:', deck.color);
}

checkStructure().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
