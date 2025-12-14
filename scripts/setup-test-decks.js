/**
 * Script to setup test decks for limit testing
 * Deletes all existing decks and creates: 2 list, 10 anki, 3 csv decks (15 total)
 */

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

async function deleteAllDecks() {
  const snapshot = await db.collection('flashcardDecks')
    .where('userId', '==', userId)
    .get();

  console.log(`Found ${snapshot.size} existing decks to delete`);

  if (snapshot.size === 0) return;

  // Delete in batches of 500
  const batches = [];
  let batch = db.batch();
  let count = 0;

  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
    if (count === 500) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  });

  if (count > 0) {
    batches.push(batch);
  }

  for (const b of batches) {
    await b.commit();
  }

  console.log(`Deleted ${snapshot.size} decks`);
}

async function createDecks() {
  const now = Date.now();
  const batch = db.batch();

  const baseStats = {
    totalCards: 5,
    newCards: 5,
    learningCards: 0,
    reviewCards: 0,
    masteredCards: 0,
    totalStudied: 0,
    averageAccuracy: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalTimeSpent: 0,
  };

  const baseSettings = {
    studyDirection: 'front-to-back',
    autoPlay: false,
    showHints: true,
    animationSpeed: 'normal',
    soundEffects: true,
    hapticFeedback: true,
    sessionLength: 20,
    reviewMode: 'srs',
  };

  const sampleCards = [
    { id: 'card-1', front: 'Hello', back: 'こんにちは' },
    { id: 'card-2', front: 'Goodbye', back: 'さようなら' },
    { id: 'card-3', front: 'Thank you', back: 'ありがとう' },
    { id: 'card-4', front: 'Yes', back: 'はい' },
    { id: 'card-5', front: 'No', back: 'いいえ' },
  ];

  // Create 2 list decks
  for (let i = 1; i <= 2; i++) {
    const deckId = `list-deck-${i}-${now}`;
    const deckRef = db.collection('flashcardDecks').doc(deckId);
    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: `My List Deck ${i}`,
      description: 'Created from a vocabulary list',
      source: 'list',
      sourceListId: `list-${i}`,
      emoji: '📝',
      color: 'primary',
      cardStyle: 'minimal',
      cardCount: 5,
      cards: sampleCards,
      settings: baseSettings,
      stats: baseStats,
      createdAt: now - (i * 86400000), // Stagger creation dates
      updatedAt: now,
    });
    console.log(`  Creating list deck: My List Deck ${i}`);
  }

  // Create 10 anki decks
  for (let i = 1; i <= 10; i++) {
    const deckId = `anki-deck-${i}-${now}`;
    const deckRef = db.collection('flashcardDecks').doc(deckId);
    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: `Anki Import ${i}`,
      description: 'Imported from Anki',
      source: 'anki',
      emoji: '📚',
      color: 'secondary',
      cardStyle: 'minimal',
      cardCount: 5,
      cards: sampleCards,
      settings: {
        ...baseSettings,
        newCardsPerDay: 20,
        reviewsPerDay: 100,
      },
      stats: baseStats,
      metadata: {
        originalFilename: `deck${i}.apkg`,
        importedAt: new Date().toISOString(),
        hasMedia: false,
        ankiImport: true,
      },
      createdAt: now - (i * 86400000),
      updatedAt: now,
    });
    console.log(`  Creating anki deck: Anki Import ${i}`);
  }

  // Create 3 csv decks
  for (let i = 1; i <= 3; i++) {
    const deckId = `csv-deck-${i}-${now}`;
    const deckRef = db.collection('flashcardDecks').doc(deckId);
    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: `CSV Import ${i}`,
      description: 'Imported from CSV file',
      source: 'csv',
      emoji: '📄',
      color: 'ocean',
      cardStyle: 'minimal',
      cardCount: 5,
      cards: sampleCards,
      settings: baseSettings,
      stats: baseStats,
      metadata: {
        originalFilename: `vocabulary${i}.csv`,
        importedAt: new Date().toISOString(),
      },
      createdAt: now - (i * 86400000),
      updatedAt: now,
    });
    console.log(`  Creating csv deck: CSV Import ${i}`);
  }

  await batch.commit();
  console.log('\nCreated 15 decks (2 list + 10 anki + 3 csv)');
}

async function main() {
  try {
    console.log('=== Setup Test Decks ===\n');
    console.log('User ID:', userId);

    console.log('\n1. Deleting all existing decks...');
    await deleteAllDecks();

    console.log('\n2. Creating test decks...');
    await createDecks();

    // Verify
    const finalSnapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    console.log(`\n=== Done! Total decks: ${finalSnapshot.size} ===`);
    console.log('\nNow try creating a new deck - you should see the limit error modal!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
