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

async function debugDecks() {
  console.log('🔍 Checking flashcard decks...\n');

  // Get all decks for this user
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`Found ${snapshot.size} total decks\n`);
  console.log('='.repeat(80));

  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`\n${index + 1}. ${data.emoji} ${data.name}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   Card Count: ${data.cardCount}`);
    console.log(`   Created: ${new Date(data.createdAt).toLocaleString()}`);

    // Check first card structure
    if (data.cards && data.cards.length > 0) {
      const firstCard = data.cards[0];
      console.log(`\n   First Card Structure:`);
      console.log(`   - ID: ${firstCard.id}`);
      console.log(`   - Front type: ${typeof firstCard.front}`);

      if (typeof firstCard.front === 'object') {
        console.log(`   - Front.text: ${firstCard.front.text}`);
        console.log(`   - Front.media exists: ${!!firstCard.front.media}`);
        if (firstCard.front.media) {
          console.log(`   - Media type: ${firstCard.front.media.type}`);
          console.log(`   - Media filename: ${firstCard.front.media.filename}`);
          console.log(`   - Media URL: ${firstCard.front.media.url?.substring(0, 60)}...`);
        }
      } else {
        console.log(`   - Front: ${firstCard.front?.substring(0, 50)}...`);
      }

      // Count cards with images
      const cardsWithImages = data.cards.filter(c =>
        typeof c.front === 'object' && c.front.media
      ).length;
      console.log(`\n   Cards with images: ${cardsWithImages}/${data.cards.length}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  process.exit(0);
}

debugDecks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
