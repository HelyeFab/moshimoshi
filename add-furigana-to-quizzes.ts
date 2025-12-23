/**
 * Add Furigana to Comic Quiz Questions
 *
 * This script adds <ruby> tags with furigana readings to all Japanese quiz questions
 * in the comics collection. This enables users to toggle furigana on/off in the quiz UI.
 */

import admin from 'firebase-admin';
import * as path from 'path';

const kuromoji = require('kuromoji');

// Type definitions
interface KuromojiToken {
  surface_form: string;
  reading?: string;
  part_of_speech: string;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

// Initialize Firebase
const serviceAccountPath = path.join(process.cwd(), 'moshimoshi-service-account.json');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

const db = admin.firestore();

// Furigana generation functions (copied from /api/furigana/route.ts)
function convertKatakanaToHiragana(katakana: string): string {
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

function generateFurigana(tokens: KuromojiToken[]): string {
  return tokens
    .map((token) => {
      const { surface_form, reading } = token;

      // Only add furigana if the surface form contains kanji and we have a reading
      if (hasKanji(surface_form) && reading && reading !== surface_form) {
        const hiraganaReading = convertKatakanaToHiragana(reading);

        // Don't add furigana if the reading is the same as the surface form
        if (hiraganaReading === surface_form) {
          return surface_form;
        } else {
          return `<ruby>${surface_form}<rt>${hiraganaReading}</rt></ruby>`;
        }
      } else {
        return surface_form;
      }
    })
    .join('');
}

function buildTokenizer(): Promise<KuromojiTokenizer> {
  return new Promise((resolve, reject) => {
    const tokenizerPath = path.join(process.cwd(), 'public', 'kuromoji_dict');

    kuromoji.builder({ dicPath: tokenizerPath }).build((err: Error | null, tokenizer: KuromojiTokenizer) => {
      if (err) {
        console.error('Failed to build tokenizer:', err);
        reject(err);
        return;
      }
      resolve(tokenizer);
    });
  });
}

async function addFuriganaToQuizzes() {
  console.log('🚀 Starting furigana addition to quiz questions...\n');

  try {
    // Build tokenizer
    console.log('📖 Building Kuromoji tokenizer...');
    const tokenizer = await buildTokenizer();
    console.log('✅ Tokenizer ready\n');

    // Fetch all comics
    const comicsSnapshot = await db.collection('comics').get();
    console.log(`📚 Found ${comicsSnapshot.size} comics\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of comicsSnapshot.docs) {
      const data = doc.data();
      const episodeId = doc.id;

      // Skip if no quiz
      if (!data.quiz || !data.quiz.questions || data.quiz.questions.length === 0) {
        console.log(`⏭️  Skipping ${episodeId} (no quiz)`);
        skippedCount++;
        continue;
      }

      console.log(`\n📝 Processing ${episodeId}...`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Questions: ${data.quiz.questions.length}`);

      try {
        // Process each question
        const updatedQuestions = data.quiz.questions.map((question: any, index: number) => {
          const questionJa = question.questionJa || '';

          // Skip if already has furigana
          if (questionJa.includes('<ruby>')) {
            console.log(`   Q${index + 1}: Already has furigana, skipping`);
            return question;
          }

          // Skip if no Japanese text
          if (!questionJa || !hasKanji(questionJa)) {
            console.log(`   Q${index + 1}: No kanji, skipping`);
            return question;
          }

          // Generate furigana
          const tokens = tokenizer.tokenize(questionJa);
          const questionWithFurigana = generateFurigana(tokens);

          console.log(`   Q${index + 1}: ✅ Added furigana`);
          console.log(`      Before: ${questionJa.substring(0, 50)}...`);
          console.log(`      After:  ${questionWithFurigana.substring(0, 80)}...`);

          return {
            ...question,
            questionJa: questionWithFurigana,
          };
        });

        // Update Firestore
        await doc.ref.update({
          'quiz.questions': updatedQuestions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`   ✅ Updated ${episodeId}`);
        updatedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing ${episodeId}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${updatedCount} episodes`);
    console.log(`   ⏭️  Skipped: ${skippedCount} episodes`);
    console.log(`   ❌ Errors:  ${errorCount} episodes`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
addFuriganaToQuizzes()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
