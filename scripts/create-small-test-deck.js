/**
 * Create a small test deck with 7 cards for testing card deletion
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
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2'; // Replace with your user ID if different

async function createSmallTestDeck() {
  try {
    const now = Date.now();
    const deckId = `test-deletion-${now}`;

    const testCards = [
      { id: `card-1-${now}`, front: { text: 'One' }, back: { text: '一' }, metadata: { status: 'new' } },
      { id: `card-2-${now}`, front: { text: 'Two' }, back: { text: '二' }, metadata: { status: 'new' } },
      { id: `card-3-${now}`, front: { text: 'Three' }, back: { text: '三' }, metadata: { status: 'new' } },
      { id: `card-4-${now}`, front: { text: 'Four' }, back: { text: '四' }, metadata: { status: 'new' } },
      { id: `card-5-${now}`, front: { text: 'Five' }, back: { text: '五' }, metadata: { status: 'new' } },
      { id: `card-6-${now}`, front: { text: 'Six' }, back: { text: '六' }, metadata: { status: 'new' } },
      { id: `card-7-${now}`, front: { text: 'Seven' }, back: { text: '七' }, metadata: { status: 'new' } },
    ];

    const deck = {
      id: deckId,
      userId: userId,
      name: 'Test Deletion Deck',
      description: 'Small test deck for testing card deletion during study',
      source: 'user',
      emoji: '🧪',
      color: 'primary',
      cardStyle: 'minimal',
      cardCount: testCards.length,
      cards: testCards,
      settings: {
        studyDirection: 'front-to-back',
        autoPlay: false,
        showHints: true,
        animationSpeed: 'normal',
        soundEffects: true,
        hapticFeedback: true,
        sessionLength: 20,
        reviewMode: 'srs',
        furigana: {
          enabled: true,
          showOnFront: true,
          showOnBack: true,
        },
      },
      stats: {
        totalCards: testCards.length,
        newCards: testCards.length,
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
    };

    console.log('Creating test deck:', deck.name);
    console.log('  Cards:', testCards.length);
    console.log('  Deck ID:', deckId);

    await db.collection('flashcardDecks').doc(deckId).set(deck);

    console.log('\n✅ Test deck created successfully!');
    console.log('\nTest plan:');
    console.log('  1. Sync the deck to local IndexedDB');
    console.log('  2. Start a study session');
    console.log('  3. Delete 1 card (should go from 7 to 6 cards)');
    console.log('  4. Exit session and verify deck has 6 cards');
    console.log('  5. Sync to Firebase and verify it still has 6 cards');

  } catch (error) {
    console.error('Error creating test deck:', error);
  } finally {
    process.exit(0);
  }
}

createSmallTestDeck();
