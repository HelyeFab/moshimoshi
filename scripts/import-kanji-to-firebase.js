#!/usr/bin/env node

/**
 * Import Kanji to Firebase Progress Document
 *
 * Usage:
 *   node scripts/import-kanji-to-firebase.js (--uid <uid> | --email <email>) <markdown-file-1> [markdown-file-2] [...]
 *
 * Example:
 *   node scripts/import-kanji-to-firebase.js \
 *     --email you@example.com \
 *     ~/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_8/Kanji_Triage_Lesson_8.md \
 *     ~/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_9/Kanji_Triage_Lesson_9.md
 */

const fs = require('fs');
const {
  admin,
  describeTarget,
  getCanonicalKanjiProgressRef,
  initAdmin,
  parseArgs,
  resolveUserId,
} = require('./lib/kanji-progress-admin');

const WRITE_KANJI_VIEW_COUNT = 6;  // Mark as "learned"
const RECOGNIZE_KANJI_VIEW_COUNT = 6;  // Also mark as "learned" (change to 3 if you want "learning")

/**
 * Extract kanji from markdown summary section
 * Looks for lines like: | ✍️ Write | 16 | 大 小 新 古 ... |
 */
function extractKanjiFromMarkdown(content) {
  const writeKanji = [];
  const recognizeKanji = [];

  // Match the summary table rows
  const writeMatch = content.match(/\|\s*✍️\s*Write\s*\|\s*\d+\s*\|\s*([^|]+)\s*\|/);
  const recognizeMatch = content.match(/\|\s*👁️\s*Recognise\s*\|\s*\d+\s*\|\s*([^|]+)\s*\|/);

  if (writeMatch) {
    const kanjiString = writeMatch[1].trim();
    // Split by spaces and filter out empty strings
    const kanji = kanjiString.split(/\s+/).filter(k => k.length > 0);
    writeKanji.push(...kanji);
  }

  if (recognizeMatch) {
    const kanjiString = recognizeMatch[1].trim();
    const kanji = kanjiString.split(/\s+/).filter(k => k.length > 0);
    recognizeKanji.push(...kanji);
  }

  return { writeKanji, recognizeKanji };
}

/**
 * Create progress data for a kanji
 */
function createProgressData(kanji, viewCount) {
  const now = new Date().toISOString();
  const status = viewCount >= 6 ? 'learned' : viewCount > 0 ? 'learning' : 'not-started';

  return {
    contentId: kanji,
    contentType: 'kanji',
    status,
    viewCount,
    correctCount: 0,
    incorrectCount: 0,
    accuracy: 0,
    streak: 0,
    bestStreak: 0,
    firstViewedAt: now,
    lastViewedAt: now,
    updatedAt: now,
  };
}

/**
 * Update Firebase with kanji progress
 */
async function updateFirebaseProgress(userId, writeKanji, recognizeKanji) {
  const db = admin.firestore();
  const docRef = getCanonicalKanjiProgressRef(db, userId);

  try {
    // Get existing document
    const doc = await docRef.get();
    const existingItems = doc.exists ? (doc.data().items || {}) : {};

    // Prepare updates
    const updates = { ...existingItems };
    let newCount = 0;
    let updatedCount = 0;

    // Add write kanji
    writeKanji.forEach(kanji => {
      if (!existingItems[kanji]) {
        newCount++;
      } else {
        updatedCount++;
      }
      updates[kanji] = createProgressData(kanji, WRITE_KANJI_VIEW_COUNT);
    });

    // Add recognize kanji
    recognizeKanji.forEach(kanji => {
      if (!existingItems[kanji]) {
        newCount++;
      } else if (!updates[kanji]) {  // Don't overwrite if already in write section
        updatedCount++;
      }
      if (!updates[kanji]) {  // Only add if not already added as write kanji
        updates[kanji] = createProgressData(kanji, RECOGNIZE_KANJI_VIEW_COUNT);
      }
    });

    // Update Firestore using the canonical path the app reads from:
    // users/{uid}/progress/kanji
    await docRef.set(
      {
        userId,
        contentType: 'kanji',
        items: updates,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`✅ Successfully updated Firebase:`);
    console.log(`   - ${newCount} new kanji added`);
    console.log(`   - ${updatedCount} existing kanji updated`);
    console.log(`   - Total kanji in collection: ${Object.keys(updates).length}`);

    return { newCount, updatedCount, total: Object.keys(updates).length };
  } catch (error) {
    console.error('❌ Error updating Firebase:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2));
  initAdmin(options.serviceAccount);

  if (positionals.length === 0) {
    console.error('❌ Usage: node import-kanji-to-firebase.js (--uid <uid> | --email <email>) <markdown-file-1> [markdown-file-2] [...]');
    process.exit(1);
  }

  console.log('🔍 Finding user...');
  const userId = await resolveUserId(options);
  console.log(`✅ Found user: ${describeTarget(options, userId)}`);
  console.log(`📍 Target document: users/${userId}/progress/kanji`);

  // Collect all kanji from all files
  const allWriteKanji = new Set();
  const allRecognizeKanji = new Set();

  for (const filePath of positionals) {
    console.log(`\n📖 Reading: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      console.error(`   ⚠️  File not found, skipping...`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const { writeKanji, recognizeKanji } = extractKanjiFromMarkdown(content);

    console.log(`   ✍️  Write kanji: ${writeKanji.length}`);
    console.log(`   👁️  Recognize kanji: ${recognizeKanji.length}`);

    writeKanji.forEach(k => allWriteKanji.add(k));
    recognizeKanji.forEach(k => allRecognizeKanji.add(k));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✍️  Total unique write kanji: ${allWriteKanji.size}`);
  console.log(`   👁️  Total unique recognize kanji: ${allRecognizeKanji.size}`);

  // Convert Sets to Arrays
  const writeKanjiArray = Array.from(allWriteKanji);
  const recognizeKanjiArray = Array.from(allRecognizeKanji);

  console.log(`\n🔥 Updating Firebase for user: ${describeTarget(options, userId)}`);
  await updateFirebaseProgress(userId, writeKanjiArray, recognizeKanjiArray);

  console.log('\n✨ Done!');
  process.exit(0);
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
