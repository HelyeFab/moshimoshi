/**
 * One-time script to backfill furigana for existing flashcard deck
 * Usage: node scripts/backfill-furigana.js
 */

const admin = require('firebase-admin');
const kuromoji = require('kuromoji');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../moshimoshi-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Tokenizer cache
let cachedTokenizer = null;

// Deck ID to process
const DECK_ID = '6b312843-8745-420b-b660-773e826fe590';

/**
 * Check if text contains Japanese kanji
 */
function hasJapaneseKanji(text) {
  if (!text) return false;
  return /[\u4E00-\u9FAF]/.test(text);
}

/**
 * Check if text already has furigana
 */
function hasExistingFurigana(text) {
  if (!text) return false;

  // Check for HTML ruby tags
  if (text.includes('<ruby>') || text.includes('<rt>')) {
    return true;
  }

  // Check for bracket notation: 漢字[かんじ]
  if (/\[[\u3040-\u309F]+\]/.test(text)) {
    return true;
  }

  // Check for parentheses notation: 漢字（かんじ）
  if (/[\u4E00-\u9FAF]+[（(][\u3040-\u309F]+[）)]/u.test(text)) {
    return true;
  }

  return false;
}

/**
 * Check if text needs furigana generation
 */
function needsFurigana(text) {
  return hasJapaneseKanji(text) && !hasExistingFurigana(text);
}

/**
 * Build kuromoji tokenizer
 */
async function buildTokenizer() {
  if (cachedTokenizer) {
    return cachedTokenizer;
  }

  return new Promise((resolve, reject) => {
    const tokenizerPath = path.join(process.cwd(), 'public', 'kuromoji_dict');

    kuromoji.builder({ dicPath: tokenizerPath }).build((err, tokenizer) => {
      if (err) {
        console.error('Failed to build tokenizer:', err);
        reject(err);
        return;
      }

      cachedTokenizer = tokenizer;
      resolve(tokenizer);
    });
  });
}

/**
 * Convert katakana to hiragana
 */
function convertKatakanaToHiragana(katakana) {
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/**
 * Check if word has kanji
 */
function hasKanji(text) {
  return /[\u4e00-\u9faf]/.test(text);
}

/**
 * Check if a word should have spacing after it
 */
function shouldAddWordSpacing(token, nextToken) {
  const { part_of_speech } = token;

  // Don't add spacing after punctuation
  if (part_of_speech === '記号' || part_of_speech === '補助記号') {
    return false;
  }

  // Don't add spacing after particles
  if (part_of_speech === '助詞') {
    return false;
  }

  // Don't add spacing after auxiliary verbs
  if (part_of_speech === '助動詞') {
    return false;
  }

  // Don't add spacing before particles if next token is a particle
  if (nextToken && nextToken.part_of_speech === '助詞') {
    return false;
  }

  // Don't add spacing before punctuation
  if (nextToken && (nextToken.part_of_speech === '記号' || nextToken.part_of_speech === '補助記号')) {
    return false;
  }

  return true;
}

/**
 * Generate furigana HTML from tokens
 */
function generateFuriganaHtml(tokens) {
  return tokens
    .map((token, index) => {
      const { surface_form, reading, part_of_speech } = token;
      const nextToken = tokens[index + 1];

      // Handle Japanese full stop - add line break after it
      if (surface_form === '。') {
        return '。<div style="height: 1.5em;"></div>';
      }

      let wordHtml = '';

      // Skip other punctuation and symbols
      if (part_of_speech === '記号' || part_of_speech === '補助記号') {
        wordHtml = surface_form;
      }
      // Only add furigana if the surface form contains kanji and we have a reading
      else if (hasKanji(surface_form) && reading && reading !== surface_form) {
        const hiraganaReading = convertKatakanaToHiragana(reading);

        // Don't add furigana if the reading is the same as the surface form
        if (hiraganaReading === surface_form) {
          wordHtml = surface_form;
        } else {
          wordHtml = `<ruby>${surface_form}<rp>(</rp><rt>${hiraganaReading}</rt><rp>)</rp></ruby>`;
        }
      } else {
        wordHtml = surface_form;
      }

      // Add word spacing after certain types of words
      if (shouldAddWordSpacing(token, nextToken)) {
        wordHtml += '<span style="margin-right: 0.25em;"></span>';
      }

      return wordHtml;
    })
    .join('');
}

/**
 * Generate furigana using kuromoji tokenizer
 */
async function generateFurigana(text) {
  if (!text || !needsFurigana(text)) {
    return null;
  }

  try {
    const tokenizer = await buildTokenizer();
    const tokens = tokenizer.tokenize(text);
    return generateFuriganaHtml(tokens);
  } catch (error) {
    console.error(`  ❌ Failed to generate furigana:`, error.message);
    return null;
  }
}

/**
 * Generate furigana for a batch of texts with rate limiting
 */
async function generateFuriganaBatch(texts) {
  const result = new Map();
  const textsToProcess = texts.filter(t => t && needsFurigana(t));

  if (textsToProcess.length === 0) {
    return result;
  }

  console.log(`  📝 Generating furigana for ${textsToProcess.length} unique texts...`);

  // Process in batches of 5 with 100ms delay
  const batchSize = 5;
  for (let i = 0; i < textsToProcess.length; i += batchSize) {
    const batch = textsToProcess.slice(i, i + batchSize);

    const promises = batch.map(async (text) => {
      const furigana = await generateFurigana(text);
      if (furigana) {
        result.set(text, furigana);
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (i + batchSize < textsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`  ✅ Generated furigana for ${result.size} texts`);
  return result;
}

/**
 * Main migration function
 */
async function backfillFurigana() {
  console.log('\n🚀 Starting furigana backfill migration...\n');
  console.log(`📦 Processing deck: ${DECK_ID}\n`);

  try {
    // Fetch the deck
    const deckRef = db.collection('flashcardDecks').doc(DECK_ID);
    const deckDoc = await deckRef.get();

    if (!deckDoc.exists) {
      console.error('❌ Deck not found!');
      process.exit(1);
    }

    const deck = deckDoc.data();
    console.log(`📚 Deck name: ${deck.name}`);
    console.log(`🃏 Total cards: ${deck.cards?.length || 0}\n`);

    if (!deck.cards || deck.cards.length === 0) {
      console.log('✅ No cards to process');
      return;
    }

    // Collect all unique texts that need furigana
    const textsToProcess = new Set();
    let cardsNeedingFurigana = 0;

    for (const card of deck.cards) {
      const frontText = card.front?.text;
      const backText = card.back?.text;
      const hasFurigana = card.metadata?.furiganaFront || card.metadata?.furiganaBack;

      if (!hasFurigana) {
        if (frontText && needsFurigana(frontText)) {
          textsToProcess.add(frontText);
          cardsNeedingFurigana++;
        }
        if (backText && needsFurigana(backText)) {
          textsToProcess.add(backText);
        }
      }
    }

    console.log(`📊 Cards needing furigana: ${cardsNeedingFurigana}`);
    console.log(`📝 Unique texts to process: ${textsToProcess.size}\n`);

    if (textsToProcess.size === 0) {
      console.log('✅ All cards already have furigana or don\'t need it');
      return;
    }

    // Generate furigana for all unique texts
    const furiganaMap = await generateFuriganaBatch(Array.from(textsToProcess));

    // Update cards with generated furigana
    let updatedCount = 0;
    const updatedCards = deck.cards.map(card => {
      const frontText = card.front?.text;
      const backText = card.back?.text;
      const hasFurigana = card.metadata?.furiganaFront || card.metadata?.furiganaBack;

      // Skip if card already has furigana
      if (hasFurigana) {
        return card;
      }

      const furiganaFront = frontText && furiganaMap.has(frontText)
        ? furiganaMap.get(frontText)
        : card.metadata?.furiganaFront;

      const furiganaBack = backText && furiganaMap.has(backText)
        ? furiganaMap.get(backText)
        : card.metadata?.furiganaBack;

      if (furiganaFront || furiganaBack) {
        updatedCount++;

        // Build metadata object only with defined values
        const newMetadata = {
          ...(card.metadata || {}),
        };

        if (furiganaFront) {
          newMetadata.furiganaFront = furiganaFront;
        }

        if (furiganaBack) {
          newMetadata.furiganaBack = furiganaBack;
        }

        return {
          ...card,
          metadata: newMetadata
        };
      }

      return card;
    });

    console.log(`\n💾 Updating ${updatedCount} cards in Firestore...`);

    // Ensure deck has furigana settings
    const updatedSettings = {
      ...(deck.settings || {}),
      furigana: {
        enabled: true,
        showOnFront: true,
        showOnBack: true,
      },
    };

    // Update the deck in Firestore
    await deckRef.update({
      cards: updatedCards,
      settings: updatedSettings,
      updatedAt: Date.now(),
    });

    console.log(`✅ Successfully updated deck with furigana!`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Total cards: ${deck.cards.length}`);
    console.log(`   - Cards updated: ${updatedCount}`);
    console.log(`   - Unique furigana generated: ${furiganaMap.size}`);

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
backfillFurigana()
  .then(() => {
    console.log('\n✨ Migration complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
