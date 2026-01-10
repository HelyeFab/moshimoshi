const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createDeck() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
    const now = Date.now();

    const deck = {
      id: `deck-clothes-ja-${now}`,
      name: '服 (Clothes) 👔',
      description: 'Learn Japanese clothing vocabulary',
      emoji: '👔',
      color: 'primary',
      cardStyle: 'minimal',
      userId: userId,
      source: 'user',
      createdAt: now,
      updatedAt: now,
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
          showOnBack: true
        }
      },
      stats: {
        totalCards: 3,
        newCards: 3,
        learningCards: 0,
        reviewCards: 0,
        masteredCards: 0,
        totalReviews: 0,
        correctReviews: 0,
        averageAccuracy: 0,
        lastReviewed: null,
        streak: 0,
        bestStreak: 0
      },
      cards: [
        {
          id: `card-${now}-1`,
          front: { text: 'シャツ' },
          back: { text: 'Shirt' },
          metadata: {
            notes: 'Upper body clothing',
            algorithm: 'fsrs',
            status: 'new'
          }
        },
        {
          id: `card-${now}-2`,
          front: { text: 'ズボン' },
          back: { text: 'Pants/Trousers' },
          metadata: {
            notes: 'Lower body clothing',
            algorithm: 'fsrs',
            status: 'new'
          }
        },
        {
          id: `card-${now}-3`,
          front: { text: '靴 (くつ)' },
          back: { text: 'Shoes' },
          metadata: {
            notes: 'Footwear',
            algorithm: 'fsrs',
            status: 'new'
          }
        }
      ]
    };

    console.log('👔 Creating Clothes deck...\n');
    console.log('Deck ID:', deck.id);
    console.log('Name:', deck.name);
    console.log('Cards:', deck.cards.length);

    await db.collection('flashcardDecks').doc(deck.id).set(deck);

    console.log('\n✅ Deck #15 created successfully!');
    console.log('\n📊 Deck count:');
    console.log('  Previous: 14 decks');
    console.log('  New: 1 deck');
    console.log('  Total: 15 decks (AT LIMIT)');
    console.log('\n📋 Next steps:');
    console.log('  1. Click "Sync All" in the UI');
    console.log('  2. All 15 decks should appear');
    console.log('  3. Try creating deck #16 - should FAIL ❌');
    console.log('  4. Error message: "You\'ve reached the maximum number of decks (15) for your plan"');

  } catch (error) {
    console.error('Error creating deck:', error);
  } finally {
    process.exit(0);
  }
}

createDeck();
