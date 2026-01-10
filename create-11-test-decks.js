const admin = require('firebase-admin');

const serviceAccount = require('/home/beano/DevProjects/NextJs/moshimoshi/moshimoshi-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const decks = [
  {
    name: '数字 (Numbers) 🔢',
    emoji: '🔢',
    description: 'Learn Japanese numbers',
    cards: [
      { front: '一 (いち)', back: 'One', notes: 'First number' },
      { front: '二 (に)', back: 'Two', notes: 'Second number' },
      { front: '三 (さん)', back: 'Three', notes: 'Third number' }
    ]
  },
  {
    name: '家族 (Family) 👨‍👩‍👧',
    emoji: '👨‍👩‍👧',
    description: 'Learn Japanese family terms',
    cards: [
      { front: '父 (ちち)', back: 'Father', notes: 'Own father' },
      { front: '母 (はは)', back: 'Mother', notes: 'Own mother' },
      { front: '兄 (あに)', back: 'Older brother', notes: 'Own older brother' }
    ]
  },
  {
    name: '天気 (Weather) ☀️',
    emoji: '☀️',
    description: 'Learn Japanese weather vocabulary',
    cards: [
      { front: '晴れ (はれ)', back: 'Sunny', notes: 'Clear weather' },
      { front: '雨 (あめ)', back: 'Rain', notes: 'Rainy weather' },
      { front: '雪 (ゆき)', back: 'Snow', notes: 'Snowy weather' }
    ]
  },
  {
    name: '体 (Body) 👤',
    emoji: '👤',
    description: 'Learn Japanese body parts',
    cards: [
      { front: '頭 (あたま)', back: 'Head', notes: 'Top of body' },
      { front: '手 (て)', back: 'Hand', notes: 'Used for holding' },
      { front: '足 (あし)', back: 'Foot/Leg', notes: 'Used for walking' }
    ]
  },
  {
    name: '時間 (Time) ⏰',
    emoji: '⏰',
    description: 'Learn Japanese time expressions',
    cards: [
      { front: '今 (いま)', back: 'Now', notes: 'Current time' },
      { front: '昨日 (きのう)', back: 'Yesterday', notes: 'Day before today' },
      { front: '明日 (あした)', back: 'Tomorrow', notes: 'Day after today' }
    ]
  },
  {
    name: '場所 (Places) 🏠',
    emoji: '🏠',
    description: 'Learn Japanese places',
    cards: [
      { front: '学校 (がっこう)', back: 'School', notes: 'Place of learning' },
      { front: '駅 (えき)', back: 'Station', notes: 'Train station' },
      { front: '公園 (こうえん)', back: 'Park', notes: 'Public park' }
    ]
  },
  {
    name: '飲み物 (Drinks) 🥤',
    emoji: '🥤',
    description: 'Learn Japanese drinks',
    cards: [
      { front: '水 (みず)', back: 'Water', notes: 'Essential drink' },
      { front: 'お茶 (おちゃ)', back: 'Tea', notes: 'Japanese tea' },
      { front: 'コーヒー', back: 'Coffee', notes: 'Coffee drink' }
    ]
  },
  {
    name: '形容詞 (Adjectives) ✨',
    emoji: '✨',
    description: 'Learn Japanese adjectives',
    cards: [
      { front: '大きい (おおきい)', back: 'Big', notes: 'Large size' },
      { front: '小さい (ちいさい)', back: 'Small', notes: 'Small size' },
      { front: '新しい (あたらしい)', back: 'New', notes: 'Recently made' }
    ]
  },
  {
    name: '動詞 (Verbs) 🏃',
    emoji: '🏃',
    description: 'Learn Japanese verbs',
    cards: [
      { front: '食べる (たべる)', back: 'To eat', notes: 'Eating action' },
      { front: '飲む (のむ)', back: 'To drink', notes: 'Drinking action' },
      { front: '見る (みる)', back: 'To see', notes: 'Seeing action' }
    ]
  },
  {
    name: '感情 (Emotions) 😊',
    emoji: '😊',
    description: 'Learn Japanese emotions',
    cards: [
      { front: '嬉しい (うれしい)', back: 'Happy', notes: 'Feeling of joy' },
      { front: '悲しい (かなしい)', back: 'Sad', notes: 'Feeling of sadness' },
      { front: '怖い (こわい)', back: 'Scary', notes: 'Feeling of fear' }
    ]
  },
  {
    name: '季節 (Seasons) 🍂',
    emoji: '🍂',
    description: 'Learn Japanese seasons',
    cards: [
      { front: '春 (はる)', back: 'Spring', notes: 'Cherry blossom season' },
      { front: '夏 (なつ)', back: 'Summer', notes: 'Hot season' },
      { front: '秋 (あき)', back: 'Autumn', notes: 'Fall season' }
    ]
  }
];

async function createDecks() {
  try {
    const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';
    const baseTime = Date.now();

    console.log('📚 Creating 11 test decks...\n');

    for (let i = 0; i < decks.length; i++) {
      const deckData = decks[i];
      const now = baseTime + (i * 1000); // Stagger timestamps

      const deck = {
        id: `deck-test-${now}`,
        name: deckData.name,
        description: deckData.description,
        emoji: deckData.emoji,
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
        cards: deckData.cards.map((card, idx) => ({
          id: `card-${now}-${idx}`,
          front: { text: card.front },
          back: { text: card.back },
          metadata: {
            notes: card.notes,
            algorithm: 'fsrs',
            status: 'new'
          }
        }))
      };

      await db.collection('flashcardDecks').doc(deck.id).set(deck);
      console.log(`✅ ${i + 1}/11 - ${deck.name}`);
    }

    console.log('\n🎉 All 11 decks created successfully!');
    console.log('\n📊 Deck count:');
    console.log('  Previous: 3 decks');
    console.log('  New: 11 decks');
    console.log('  Total: 14 decks');
    console.log('\n📋 Next steps:');
    console.log('  1. Click "Sync All" in the UI');
    console.log('  2. All 14 decks should appear');
    console.log('  3. Try creating deck #15 - should work ✅');
    console.log('  4. Try creating deck #16 - should fail with limit error ❌');

  } catch (error) {
    console.error('Error creating decks:', error);
  } finally {
    process.exit(0);
  }
}

createDecks();
