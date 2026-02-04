#!/usr/bin/env node

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

async function testImageUrls() {
  console.log('🔍 Getting sample image URLs...\n');

  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.log('No decks found');
    process.exit(0);
  }

  const deck = snapshot.docs[0].data();
  console.log(`Deck: ${deck.name}\n`);

  // Get first 3 cards with images
  const cardsWithImages = deck.cards
    .filter(c => c.front?.media)
    .slice(0, 3);

  console.log('Sample Image URLs:\n');
  cardsWithImages.forEach((card, i) => {
    console.log(`${i + 1}. Card: ${card.front.text}`);
    console.log(`   URL: ${card.front.media.url}`);
    console.log(`   Filename: ${card.front.media.filename}`);
    console.log(`   Type: ${card.front.media.type}`);
    console.log('');
  });

  console.log('\nTest these URLs in your browser to verify they work.\n');
  process.exit(0);
}

testImageUrls().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
