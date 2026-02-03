#!/usr/bin/env node

/**
 * Script to create 3 test decks with 10 cards each
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

async function createThreeDecks() {
  const now = Date.now();
  const batch = db.batch();

  const baseStats = {
    totalCards: 10,
    newCards: 10,
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
    newCardsPerDay: 20,
    reviewsPerDay: 100,
  };

  // Deck 1: Basic Japanese Greetings (10 cards)
  const greetingsCards = [
    { id: 'card-1', front: 'Hello', back: 'こんにちは (konnichiwa)' },
    { id: 'card-2', front: 'Good morning', back: 'おはよう (ohayou)' },
    { id: 'card-3', front: 'Good evening', back: 'こんばんは (konbanwa)' },
    { id: 'card-4', front: 'Goodbye', back: 'さようなら (sayounara)' },
    { id: 'card-5', front: 'Thank you', back: 'ありがとう (arigatou)' },
    { id: 'card-6', front: 'You\'re welcome', back: 'どういたしまして (douitashimashite)' },
    { id: 'card-7', front: 'Excuse me', back: 'すみません (sumimasen)' },
    { id: 'card-8', front: 'I\'m sorry', back: 'ごめんなさい (gomen nasai)' },
    { id: 'card-9', front: 'Please', back: 'お願いします (onegaishimasu)' },
    { id: 'card-10', front: 'Nice to meet you', back: 'はじめまして (hajimemashite)' },
  ];

  // Deck 2: Numbers 1-10 (10 cards)
  const numbersCards = [
    { id: 'card-1', front: 'One', back: '一 (いち - ichi)' },
    { id: 'card-2', front: 'Two', back: '二 (に - ni)' },
    { id: 'card-3', front: 'Three', back: '三 (さん - san)' },
    { id: 'card-4', front: 'Four', back: '四 (よん/し - yon/shi)' },
    { id: 'card-5', front: 'Five', back: '五 (ご - go)' },
    { id: 'card-6', front: 'Six', back: '六 (ろく - roku)' },
    { id: 'card-7', front: 'Seven', back: '七 (なな/しち - nana/shichi)' },
    { id: 'card-8', front: 'Eight', back: '八 (はち - hachi)' },
    { id: 'card-9', front: 'Nine', back: '九 (きゅう/く - kyuu/ku)' },
    { id: 'card-10', front: 'Ten', back: '十 (じゅう - juu)' },
  ];

  // Deck 3: Basic Colors (10 cards)
  const colorsCards = [
    { id: 'card-1', front: 'Red', back: '赤 (あか - aka)' },
    { id: 'card-2', front: 'Blue', back: '青 (あお - ao)' },
    { id: 'card-3', front: 'Yellow', back: '黄色 (きいろ - kiiro)' },
    { id: 'card-4', front: 'Green', back: '緑 (みどり - midori)' },
    { id: 'card-5', front: 'White', back: '白 (しろ - shiro)' },
    { id: 'card-6', front: 'Black', back: '黒 (くろ - kuro)' },
    { id: 'card-7', front: 'Pink', back: 'ピンク (pinku)' },
    { id: 'card-8', front: 'Orange', back: 'オレンジ (orenji)' },
    { id: 'card-9', front: 'Purple', back: '紫 (むらさき - murasaki)' },
    { id: 'card-10', front: 'Brown', back: '茶色 (ちゃいろ - chairo)' },
  ];

  const decks = [
    {
      name: 'Japanese Greetings 👋',
      description: 'Essential Japanese greetings and polite expressions',
      emoji: '👋',
      color: 'primary',
      cards: greetingsCards,
    },
    {
      name: 'Numbers 1-10 🔢',
      description: 'Learn to count from 1 to 10 in Japanese',
      emoji: '🔢',
      color: 'ocean',
      cards: numbersCards,
    },
    {
      name: 'Basic Colors 🎨',
      description: 'Common color names in Japanese',
      emoji: '🎨',
      color: 'sunset',
      cards: colorsCards,
    },
  ];

  decks.forEach((deck, i) => {
    const deckId = `test-deck-${i + 1}-${now}`;
    const deckRef = db.collection('flashcardDecks').doc(deckId);

    batch.set(deckRef, {
      id: deckId,
      userId: userId,
      name: deck.name,
      description: deck.description,
      source: 'manual',
      emoji: deck.emoji,
      color: deck.color,
      cardStyle: 'minimal',
      cardCount: 10,
      cards: deck.cards,
      settings: baseSettings,
      stats: baseStats,
      createdAt: now - (i * 1000), // Stagger by 1 second each
      updatedAt: now,
    });

    console.log(`  ✓ Creating: ${deck.name}`);
  });

  await batch.commit();
  console.log('\n✅ Successfully created 3 decks with 10 cards each!');
}

async function main() {
  try {
    console.log('=== Creating 3 Test Decks ===\n');
    console.log('User ID:', userId);
    console.log('Cards per deck: 10\n');

    await createThreeDecks();

    // Verify
    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .get();

    console.log(`\n📊 Total decks in your account: ${snapshot.size}`);
    console.log('\n🎉 Done! Check your flashcards page.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

main();
