#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkDeckDetails() {
  const deckDoc = await db.collection('flashcardDecks').doc('1').get();

  if (!deckDoc.exists) {
    console.log('❌ Deck not found');
    process.exit(1);
  }

  const data = deckDoc.data();

  console.log('📦 Deck Details:');
  console.log('  Deck ID:', deckDoc.id);
  console.log('  Name:', data.name);
  console.log('  Source:', data.source);
  console.log('  User ID:', data.userId);
  console.log('  Total Cards:', data.cards?.length || 0);
  console.log('');

  // Check first few cards for media
  console.log('🎴 Sample Cards (checking for media):');
  const cardsWithMedia = data.cards?.slice(0, 5) || [];

  cardsWithMedia.forEach((card, idx) => {
    console.log(`Card ${idx + 1}:`);
    console.log('  Front:', typeof card.front === 'string' ? card.front.substring(0, 50) : JSON.stringify(card.front).substring(0, 50));
    console.log('  Back:', typeof card.back === 'string' ? card.back.substring(0, 50) : JSON.stringify(card.back).substring(0, 50));
    console.log('  imageUrl:', card.imageUrl || 'none');
    console.log('  audioUrl:', card.audioUrl || 'none');
    console.log('  imageFilename:', card.imageFilename || 'none');
    console.log('  audioFilename:', card.audioFilename || 'none');
    console.log('');
  });

  // Count cards with media filenames
  const cardsWithImage = data.cards?.filter(c => c.imageFilename) || [];
  const cardsWithAudio = data.cards?.filter(c => c.audioFilename) || [];

  console.log('📊 Media Statistics:');
  console.log('  Cards with imageFilename:', cardsWithImage.length);
  console.log('  Cards with audioFilename:', cardsWithAudio.length);

  process.exit(0);
}

checkDeckDetails().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
