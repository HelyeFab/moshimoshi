#!/usr/bin/env node

/**
 * Enhanced Script to create 3 test decks with 20 cards each
 * Includes Pixabay images downloaded and uploaded to Firebase Storage
 *
 * Prerequisites:
 * 1. Add PIXABAY_API_KEY to .env.local (get free key from https://pixabay.com/api/docs/)
 * 2. Ensure Firebase Storage is configured
 *
 * Usage:
 *   node scripts/create-3-decks-enhanced.js
 */

const admin = require('firebase-admin');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const serviceAccountPath = path.join(__dirname, '../moshimoshi-service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'moshimoshi-de237.firebasestorage.app'
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const userId = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

// Check for Pixabay API key
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
if (!PIXABAY_API_KEY) {
  console.error('\n❌ Error: PIXABAY_API_KEY not found in .env.local');
  console.error('Please add PIXABAY_API_KEY to your .env.local file');
  console.error('Get a free API key from: https://pixabay.com/api/docs/\n');
  process.exit(1);
}

/**
 * Search Pixabay for an image
 */
async function searchPixabayImage(query, category = '') {
  return new Promise((resolve, reject) => {
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3&safesearch=true${category ? `&category=${category}` : ''}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.hits && result.hits.length > 0) {
            // Return the first high-quality image URL (640px width)
            resolve(result.hits[0].webformatURL);
          } else {
            console.warn(`    ⚠️  No images found for query: ${query}`);
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Download an image from a URL to a temporary file
 */
async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const tempPath = path.join(os.tmpdir(), filename);
    const file = fs.createWriteStream(tempPath);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    }).on('error', (err) => {
      fs.unlink(tempPath, () => {});
      reject(err);
    });
  });
}

/**
 * Upload image to Firebase Storage
 */
async function uploadToFirebase(localPath, storagePath) {
  try {
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          uploadedBy: 'create-3-decks-enhanced',
          timestamp: Date.now().toString()
        }
      }
    });

    // Make the file publicly accessible
    const file = bucket.file(storagePath);
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Clean up temp file
    fs.unlinkSync(localPath);

    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Upload failed for ${storagePath}:`, error.message);
    throw error;
  }
}

/**
 * Process and upload an image for a card
 */
async function processCardImage(searchQuery, deckId, cardId, category = '') {
  try {
    const filename = `${cardId}.jpg`;
    console.log(`    🔍 Searching Pixabay for: "${searchQuery}"`);

    // Search for image on Pixabay
    const imageUrl = await searchPixabayImage(searchQuery, category);

    if (!imageUrl) {
      console.log(`    ⚠️  No image found, skipping...`);
      return null;
    }

    console.log(`    📥 Downloading image...`);
    const localPath = await downloadImage(imageUrl, filename);

    console.log(`    ⬆️  Uploading to Firebase Storage...`);
    const storagePath = `flashcard-media/${userId}/${deckId}/${filename}`;
    const publicUrl = await uploadToFirebase(localPath, storagePath);

    console.log(`    ✅ Success!`);

    return {
      filename,
      url: publicUrl
    };
  } catch (error) {
    console.error(`    ⚠️  Failed to process image:`, error.message);
    return null;
  }
}

async function createThreeDecks() {
  const now = Date.now();

  const baseStats = {
    totalCards: 20,
    newCards: 20,
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

  // Deck 1: Japanese Greetings (20 cards)
  const greetingsCardsData = [
    { id: 'card-1', front: 'Hello', back: 'こんにちは (konnichiwa)', search: 'japanese greeting hello wave' },
    { id: 'card-2', front: 'Good morning', back: 'おはよう (ohayou)', search: 'sunrise morning japan' },
    { id: 'card-3', front: 'Good evening', back: 'こんばんは (konbanwa)', search: 'sunset evening japan' },
    { id: 'card-4', front: 'Goodbye', back: 'さようなら (sayounara)', search: 'goodbye waving hand' },
    { id: 'card-5', front: 'Thank you', back: 'ありがとう (arigatou)', search: 'thank you gratitude bow' },
    { id: 'card-6', front: 'You\'re welcome', back: 'どういたしまして (douitashimashite)', search: 'welcome smile friendly' },
    { id: 'card-7', front: 'Excuse me', back: 'すみません (sumimasen)', search: 'excuse me polite gesture' },
    { id: 'card-8', front: 'I\'m sorry', back: 'ごめんなさい (gomen nasai)', search: 'sorry apology sad' },
    { id: 'card-9', front: 'Please', back: 'お願いします (onegaishimasu)', search: 'please request hands' },
    { id: 'card-10', front: 'Nice to meet you', back: 'はじめまして (hajimemashite)', search: 'handshake meeting introduction' },
    { id: 'card-11', front: 'Good night', back: 'おやすみなさい (oyasuminasai)', search: 'night moon stars sleep' },
    { id: 'card-12', front: 'See you later', back: 'またね (mata ne)', search: 'see you later goodbye casual' },
    { id: 'card-13', front: 'Welcome', back: 'いらっしゃいませ (irasshaimase)', search: 'welcome door open shop' },
    { id: 'card-14', front: 'Take care', back: '気をつけて (ki wo tsukete)', search: 'take care safety umbrella' },
    { id: 'card-15', front: 'Long time no see', back: '久しぶり (hisashiburi)', search: 'reunion friends meeting' },
    { id: 'card-16', front: 'How are you?', back: '元気ですか？ (genki desu ka?)', search: 'how are you question conversation' },
    { id: 'card-17', front: 'I\'m fine', back: '元気です (genki desu)', search: 'happy healthy thumbs up' },
    { id: 'card-18', front: 'Yes', back: 'はい (hai)', search: 'yes checkmark approval' },
    { id: 'card-19', front: 'No', back: 'いいえ (iie)', search: 'no cross decline' },
    { id: 'card-20', front: 'Please wait', back: 'ちょっと待ってください (chotto matte kudasai)', search: 'wait clock time patience' },
  ];

  // Deck 2: Numbers 1-20 (20 cards)
  const numbersCardsData = [
    { id: 'card-1', front: 'One', back: '一 (いち - ichi)', search: 'number one 1 digit' },
    { id: 'card-2', front: 'Two', back: '二 (に - ni)', search: 'number two 2 digit' },
    { id: 'card-3', front: 'Three', back: '三 (さん - san)', search: 'number three 3 digit' },
    { id: 'card-4', front: 'Four', back: '四 (よん/し - yon/shi)', search: 'number four 4 digit' },
    { id: 'card-5', front: 'Five', back: '五 (ご - go)', search: 'number five 5 digit' },
    { id: 'card-6', front: 'Six', back: '六 (ろく - roku)', search: 'number six 6 digit' },
    { id: 'card-7', front: 'Seven', back: '七 (なな/しち - nana/shichi)', search: 'number seven 7 digit' },
    { id: 'card-8', front: 'Eight', back: '八 (はち - hachi)', search: 'number eight 8 digit' },
    { id: 'card-9', front: 'Nine', back: '九 (きゅう/く - kyuu/ku)', search: 'number nine 9 digit' },
    { id: 'card-10', front: 'Ten', back: '十 (じゅう - juu)', search: 'number ten 10 digit' },
    { id: 'card-11', front: 'Eleven', back: '十一 (じゅういち - juuichi)', search: 'number eleven 11 digit' },
    { id: 'card-12', front: 'Twelve', back: '十二 (じゅうに - juuni)', search: 'number twelve 12 digit' },
    { id: 'card-13', front: 'Thirteen', back: '十三 (じゅうさん - juusan)', search: 'number thirteen 13 digit' },
    { id: 'card-14', front: 'Fourteen', back: '十四 (じゅうよん - juuyon)', search: 'number fourteen 14 digit' },
    { id: 'card-15', front: 'Fifteen', back: '十五 (じゅうご - juugo)', search: 'number fifteen 15 digit' },
    { id: 'card-16', front: 'Sixteen', back: '十六 (じゅうろく - juuroku)', search: 'number sixteen 16 digit' },
    { id: 'card-17', front: 'Seventeen', back: '十七 (じゅうなな - juunana)', search: 'number seventeen 17 digit' },
    { id: 'card-18', front: 'Eighteen', back: '十八 (じゅうはち - juuhachi)', search: 'number eighteen 18 digit' },
    { id: 'card-19', front: 'Nineteen', back: '十九 (じゅうきゅう - juukyuu)', search: 'number nineteen 19 digit' },
    { id: 'card-20', front: 'Twenty', back: '二十 (にじゅう - nijuu)', search: 'number twenty 20 digit' },
  ];

  // Deck 3: Basic Colors (20 cards)
  const colorsCardsData = [
    { id: 'card-1', front: 'Red', back: '赤 (あか - aka)', search: 'red color vibrant' },
    { id: 'card-2', front: 'Blue', back: '青 (あお - ao)', search: 'blue color sky' },
    { id: 'card-3', front: 'Yellow', back: '黄色 (きいろ - kiiro)', search: 'yellow color bright' },
    { id: 'card-4', front: 'Green', back: '緑 (みどり - midori)', search: 'green color nature' },
    { id: 'card-5', front: 'White', back: '白 (しろ - shiro)', search: 'white color pure' },
    { id: 'card-6', front: 'Black', back: '黒 (くろ - kuro)', search: 'black color dark' },
    { id: 'card-7', front: 'Pink', back: 'ピンク (pinku)', search: 'pink color soft' },
    { id: 'card-8', front: 'Orange', back: 'オレンジ (orenji)', search: 'orange color fruit' },
    { id: 'card-9', front: 'Purple', back: '紫 (むらさき - murasaki)', search: 'purple color lavender' },
    { id: 'card-10', front: 'Brown', back: '茶色 (ちゃいろ - chairo)', search: 'brown color wood' },
    { id: 'card-11', front: 'Gray', back: '灰色 (はいいろ - haiiro)', search: 'gray color neutral' },
    { id: 'card-12', front: 'Silver', back: '銀色 (ぎんいろ - gin\'iro)', search: 'silver color metallic shiny' },
    { id: 'card-13', front: 'Gold', back: '金色 (きんいろ - kin\'iro)', search: 'gold color metallic shiny' },
    { id: 'card-14', front: 'Beige', back: 'ベージュ (bēju)', search: 'beige color sand' },
    { id: 'card-15', front: 'Navy', back: 'ネイビー (neibī)', search: 'navy blue dark' },
    { id: 'card-16', front: 'Turquoise', back: 'ターコイズ (tākoizu)', search: 'turquoise color cyan aqua' },
    { id: 'card-17', front: 'Maroon', back: 'マルーン (marūn)', search: 'maroon color burgundy' },
    { id: 'card-18', front: 'Coral', back: 'コーラル (kōraru)', search: 'coral color pink orange' },
    { id: 'card-19', front: 'Mint', back: 'ミント (minto)', search: 'mint color green fresh' },
    { id: 'card-20', front: 'Cream', back: 'クリーム (kurīmu)', search: 'cream color soft white' },
  ];

  const decks = [
    {
      name: 'Japanese Greetings 👋',
      description: 'Essential Japanese greetings and polite expressions with visual aids',
      emoji: '👋',
      color: 'primary',
      cardsData: greetingsCardsData,
    },
    {
      name: 'Numbers 1-20 🔢',
      description: 'Learn to count from 1 to 20 in Japanese with number visuals',
      emoji: '🔢',
      color: 'ocean',
      cardsData: numbersCardsData,
    },
    {
      name: 'Basic Colors 🎨',
      description: 'Common color names in Japanese with colorful images',
      emoji: '🎨',
      color: 'sunset',
      cardsData: colorsCardsData,
    },
  ];

  // Process each deck
  for (const [deckIndex, deck] of decks.entries()) {
    const deckId = `enhanced-deck-${deckIndex + 1}-${now}`;
    console.log(`\n╔${'═'.repeat(60)}╗`);
    console.log(`║  📦 Processing Deck ${deckIndex + 1}/3: ${deck.name.padEnd(45)}║`);
    console.log(`║     Deck ID: ${deckId.padEnd(48)}║`);
    console.log(`╚${'═'.repeat(60)}╝`);

    // Process cards with images
    const processedCards = [];
    for (const [index, cardData] of deck.cardsData.entries()) {
      console.log(`\n  🎴 Card ${index + 1}/20: ${cardData.front}`);

      // Process image (with a small delay to respect Pixabay rate limits)
      if (index > 0 && index % 5 === 0) {
        console.log(`    ⏸️  Pausing briefly (Pixabay rate limit)...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const media = await processCardImage(cardData.search, deckId, cardData.id);

      // Create card with CardSide structure matching FlashcardViewer expectations
      const card = {
        id: cardData.id,
        front: {
          text: cardData.front,
          media: media ? {
            type: 'image',
            filename: media.filename,
            url: media.url,
            alt: cardData.front
          } : undefined
        },
        back: {
          text: cardData.back
        }
      };

      processedCards.push(card);
    }

    // Save deck to Firestore
    console.log(`\n  💾 Saving deck to Firestore...`);
    const deckRef = db.collection('flashcardDecks').doc(deckId);
    await deckRef.set({
      id: deckId,
      userId: userId,
      name: deck.name,
      description: deck.description,
      source: 'manual',
      emoji: deck.emoji,
      color: deck.color,
      cardStyle: 'minimal',
      cardCount: 20,
      cards: processedCards,
      settings: baseSettings,
      stats: baseStats,
      createdAt: now - (deckIndex * 1000),
      updatedAt: now,
    });

    const cardsWithImages = processedCards.filter(c => c.front.media).length;
    console.log(`\n  ✅ Deck created successfully!`);
    console.log(`     - Total cards: ${processedCards.length}`);
    console.log(`     - Cards with images: ${cardsWithImages}`);
    console.log(`     - Cards without images: ${processedCards.length - cardsWithImages}`);
  }
}

async function main() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║     🎴 Enhanced Flashcard Deck Creator 🎴                 ║');
    console.log('║     Creating 3 decks with 20 cards each                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('📋 Configuration:');
    console.log(`   User ID: ${userId}`);
    console.log(`   Cards per deck: 20`);
    console.log(`   Total cards: 60`);
    console.log(`   Images: From Pixabay API`);
    console.log(`   Storage: Firebase Storage\n`);

    const startTime = Date.now();
    await createThreeDecks();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Verify
    const snapshot = await db.collection('flashcardDecks')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                      📊 Summary                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log(`⏱️  Time taken: ${duration}s`);
    console.log(`📊 Total decks in your account: ${snapshot.size}`);
    console.log('\n📚 Recent decks:');
    snapshot.forEach((doc, i) => {
      const data = doc.data();
      const cardsWithImages = data.cards?.filter(c => c.front?.media)?.length || 0;
      console.log(`   ${i + 1}. ${data.emoji} ${data.name}`);
      console.log(`      - ${data.cardCount} cards (${cardsWithImages} with images)`);
    });
    console.log('\n🎉 Done! Check your flashcards page at /en/flashcards\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

main();
