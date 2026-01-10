const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createFoodDeck() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
    const now = Date.now();

    const deck = {
      id: `deck-food-ja-${now}`,
      name: '食べ物 (Food) 🍜',
      description: 'Learn Japanese food vocabulary',
      emoji: '🍜',
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
          front: {
            text: '寿司 (すし)'
          },
          back: {
            text: 'Sushi'
          },
          metadata: {
            notes: 'Popular Japanese dish',
            furiganaFront: '<ruby>寿司<rp>(</rp><rt>すし</rt><rp>)</rp></ruby><span style="margin-right: 0.25em;"></span> <span style="margin-right: 0.25em;"></span>(<span style="margin-right: 0.25em;"></span>すし<span style="margin-right: 0.25em;"></span>)<span style="margin-right: 0.25em;"></span>',
            algorithm: 'fsrs',
            status: 'new'
          }
        },
        {
          id: `card-${now}-2`,
          front: {
            text: 'ラーメン'
          },
          back: {
            text: 'Ramen'
          },
          metadata: {
            notes: 'Japanese noodle soup',
            furiganaFront: 'ラーメン',
            algorithm: 'fsrs',
            status: 'new'
          }
        },
        {
          id: `card-${now}-3`,
          front: {
            text: '天ぷら (てんぷら)'
          },
          back: {
            text: 'Tempura'
          },
          metadata: {
            notes: 'Deep-fried seafood or vegetables',
            furiganaFront: '<ruby>天<rp>(</rp><rt>てん</rt><rp>)</rp></ruby><span style="margin-right: 0.25em;"></span>ぷら<span style="margin-right: 0.25em;"></span> <span style="margin-right: 0.25em;"></span>(<span style="margin-right: 0.25em;"></span>てんぷら<span style="margin-right: 0.25em;"></span>)<span style="margin-right: 0.25em;"></span>',
            algorithm: 'fsrs',
            status: 'new'
          }
        }
      ]
    };

    console.log('🍜 Creating Japanese Food deck...\n');
    console.log('Deck ID:', deck.id);
    console.log('Name:', deck.name);
    console.log('Description:', deck.description);
    console.log('Cards:', deck.cards.length);

    await db.collection('flashcardDecks').doc(deck.id).set(deck);

    console.log('\n✅ Deck created successfully in Firebase!');
    console.log('\n📋 Next steps:');
    console.log('  1. Click "Sync All" in the UI');
    console.log('  2. The Food deck should appear in your deck list');
    console.log('  3. Ready to test deck limit enforcement!');

  } catch (error) {
    console.error('Error creating deck:', error);
  } finally {
    process.exit(0);
  }
}

createFoodDeck();
