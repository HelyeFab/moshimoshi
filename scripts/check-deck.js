const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkDeck() {
  try {
    // Check flashcardDecks collection
    const flashcardDecksSnapshot = await db
      .collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    console.log('📦 Flashcard Decks Collection:');
    if (flashcardDecksSnapshot.empty) {
      console.log('  ❌ No decks found\n');
    } else {
      console.log(`  ✅ Found ${flashcardDecksSnapshot.size} deck(s)\n`);
      flashcardDecksSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  Deck ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Source: ${data.source}`);
        console.log(`  Card Count: ${data.cards?.length || 0}`);
        console.log(`  Created: ${data.createdAt?.toDate?.() || 'N/A'}`);
        console.log(`  Updated: ${data.updatedAt?.toDate?.() || 'N/A'}`);
        console.log('');
      });
    }

    // Check ankiDecks collection (if exists)
    const ankiDecksSnapshot = await db
      .collection('ankiDecks')
      .where('userId', '==', userId)
      .get();

    console.log('📚 Anki Decks Collection:');
    if (ankiDecksSnapshot.empty) {
      console.log('  ❌ No Anki decks found\n');
    } else {
      console.log(`  ✅ Found ${ankiDecksSnapshot.size} Anki deck(s)\n`);
      ankiDecksSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  Deck ID: ${doc.id}`);
        console.log(`  Name: ${data.name}`);
        console.log(`  Card Count: ${data.cardCount || 0}`);
        console.log(`  Created: ${data.createdAt?.toDate?.() || 'N/A'}`);
        console.log('');
      });
    }

    // Check for media files in any deck
    console.log('🎬 Checking for media files...');
    const allDecks = [...flashcardDecksSnapshot.docs, ...ankiDecksSnapshot.docs];

    if (allDecks.length > 0) {
      for (const deckDoc of allDecks) {
        const mediaSnapshot = await db
          .collection('users').doc(userId)
          .collection('ankiDecks').doc(deckDoc.id)
          .collection('media')
          .get();

        if (!mediaSnapshot.empty) {
          console.log(`  ✅ Deck "${deckDoc.data().name}" has ${mediaSnapshot.size} media files`);

          // Show first 3 files
          const samples = mediaSnapshot.docs.slice(0, 3);
          samples.forEach(mediaDoc => {
            const media = mediaDoc.data();
            console.log(`    - ${media.filename} (${(media.size / 1024).toFixed(2)} KB)`);
          });
          if (mediaSnapshot.size > 3) {
            console.log(`    ... and ${mediaSnapshot.size - 3} more files`);
          }
        } else {
          console.log(`  ⚠️  Deck "${deckDoc.data().name}" has NO media files in Firestore`);
        }
      }
    } else {
      console.log('  ⚠️  No decks to check for media');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }

  process.exit(0);
}

checkDeck();
