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

async function cleanupOldDecks() {
  console.log('🧹 Cleaning up old 10-card test decks...\n');

  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`Found ${snapshot.size} total decks\n`);

  const toDelete = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // Delete decks with 10 cards (the old test decks)
    if (data.cardCount === 10) {
      toDelete.push({
        id: doc.id,
        name: data.name
      });
    }
  });

  if (toDelete.length === 0) {
    console.log('✅ No old decks to delete\n');
    process.exit(0);
  }

  console.log(`Found ${toDelete.length} old deck(s) to delete:\n`);
  toDelete.forEach((deck, i) => {
    console.log(`  ${i + 1}. ${deck.name} (${deck.id})`);
  });

  console.log('\n⚠️  Deleting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🗑️  Deleting...\n');

  const batch = db.batch();
  toDelete.forEach(deck => {
    const deckRef = db.collection('flashcardDecks').doc(deck.id);
    batch.delete(deckRef);
  });

  await batch.commit();

  console.log(`✅ Deleted ${toDelete.length} old deck(s)\n`);

  // Verify
  const remaining = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`📊 Remaining decks: ${remaining.size}`);
  remaining.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${data.emoji} ${data.name} (${data.cardCount} cards)`);
  });

  console.log('\n🎉 Done!\n');
  process.exit(0);
}

cleanupOldDecks().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
