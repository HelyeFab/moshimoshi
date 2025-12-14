/**
 * Script to add dummy Anki decks to Firebase for testing the import limit
 * Run with: node scripts/add-dummy-anki-decks.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function getCurrentDeckCount() {
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .where('source', '==', 'anki')
    .get();
  return snapshot.size;
}

async function addDummyDecks(count) {
  const batch = db.batch();
  const now = Date.now();

  for (let i = 1; i <= count; i++) {
    const deckId = `dummy-anki-deck-${i}-${now}`;
    const deckRef = db.collection('flashcardDecks').doc(deckId);

    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: `Test Deck ${i}`,
      description: 'Dummy deck for limit testing',
      source: 'anki',
      emoji: '📚',
      color: 'secondary',
      cardStyle: 'minimal',
      cardCount: 1,
      cards: [{ id: `card-${i}`, front: 'Test front', back: 'Test back' }],
      settings: { newCardsPerDay: 20, reviewsPerDay: 100 },
      stats: {
        totalCards: 1,
        newCards: 1,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalStudied: 0,
        averageAccuracy: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalTimeSpent: 0,
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  await batch.commit();
  console.log(`Added ${count} dummy decks`);
}

async function main() {
  try {
    const currentCount = await getCurrentDeckCount();
    console.log(`Current Anki deck count: ${currentCount}`);

    const targetCount = 15;
    const decksToAdd = targetCount - currentCount;

    if (decksToAdd <= 0) {
      console.log(`Already at or above ${targetCount} decks. No decks added.`);
      if (currentCount >= 15) {
        console.log('⚠️  You already have 15+ decks - importing will show the error!');
      }
      return;
    }

    console.log(`Adding ${decksToAdd} dummy decks to reach ${targetCount}...`);
    await addDummyDecks(decksToAdd);

    const newCount = await getCurrentDeckCount();
    console.log(`\n✅ Done! New deck count: ${newCount}`);
    console.log('\nNow try importing an Anki deck to see the limit error modal!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
