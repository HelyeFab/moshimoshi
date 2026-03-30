#!/usr/bin/env node

/**
 * Import Kanji from Markdown Triage Files to Firebase
 *
 * Extracts kanji from markdown files with summary tables and imports them
 * into the user's kanji progress document in Firebase.
 *
 * Usage:
 *   node scripts/import-kanji-to-firebase-emmanuel.js --email emmanuelfabiani23@gmail.com <markdown-files...>
 *
 * Example:
 *   node scripts/import-kanji-to-firebase-emmanuel.js \
 *     --email emmanuelfabiani23@gmail.com \
 *     ~/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_8/Kanji_Triage_Lesson_8.md \
 *     ~/Documents/UnSync/Life-Org/04_JapaneseLanguage/Minna/Lesson_9/Kanji_Triage_Lesson_9.md
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../moshimoshi-service-account.json');

// Parse command line arguments
const args = process.argv.slice(2);
let email = 'emmanuelfabiani23@gmail.com';
const markdownFiles = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && i + 1 < args.length) {
    email = args[i + 1];
    i++;
  } else if (!args[i].startsWith('--')) {
    markdownFiles.push(args[i]);
  }
}

if (markdownFiles.length === 0) {
  console.error('❌ Error: No markdown files provided');
  console.log('\nUsage:');
  console.log('  node scripts/import-kanji-to-firebase-emmanuel.js --email <email> <markdown-files...>');
  console.log('\nExample:');
  console.log('  node scripts/import-kanji-to-firebase-emmanuel.js \\');
  console.log('    --email emmanuelfabiani23@gmail.com \\');
  console.log('    ~/path/to/Kanji_Triage_Lesson_8.md');
  process.exit(1);
}

console.log('📚 Kanji Import Script');
console.log('━'.repeat(60));
console.log(`📧 Email: ${email}`);
console.log(`📄 Files: ${markdownFiles.length}`);
markdownFiles.forEach(f => console.log(`   - ${f}`));
console.log('━'.repeat(60));
console.log('');

/**
 * Extract kanji from markdown summary tables
 * Format: | ✍️ Write | 18 | 好 上 下 手 子 歌 字 時 間 少 早 速 今 度 夫 妻 金 食 |
 */
function extractKanjiFromMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return { write: [], recognise: [] };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const writeKanji = [];
  const recogniseKanji = [];

  for (const line of lines) {
    // Match summary table rows
    // | ✍️ Write | 18 | 好 上 下 手 子 歌 字 時 間 少 早 速 今 度 夫 妻 金 食 |
    // | 👁️ Recognise | 26 | 嫌 料 理 飲 野 球 音 漢 細 用 事 約 束 主 奥 家 内 全 然 残 念 舞 伎 絵 願 楽 |

    const writeMatch = line.match(/\|\s*✍️\s*Write\s*\|\s*\d+\s*\|\s*(.+?)\s*\|/i);
    if (writeMatch) {
      const kanjiStr = writeMatch[1].trim();
      // Split by spaces and filter out empty strings
      const kanji = kanjiStr.split(/\s+/).filter(k => k.length > 0);
      writeKanji.push(...kanji);
    }

    const recogniseMatch = line.match(/\|\s*👁️\s*Recognise\s*\|\s*\d+\s*\|\s*(.+?)\s*\|/i);
    if (recogniseMatch) {
      const kanjiStr = recogniseMatch[1].trim();
      const kanji = kanjiStr.split(/\s+/).filter(k => k.length > 0);
      recogniseKanji.push(...kanji);
    }
  }

  return { write: writeKanji, recognise: recogniseKanji };
}

/**
 * Initialize Firebase Admin
 */
function initFirebase() {
  if (admin.apps.length > 0) {
    return;
  }

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`❌ Service account not found: ${SERVICE_ACCOUNT_PATH}`);
    process.exit(1);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

/**
 * Main import function
 */
async function importKanji() {
  try {
    initFirebase();

    const auth = admin.auth();
    const firestore = admin.firestore();

    // Get user UID
    console.log(`🔍 Looking up user: ${email}`);
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`✅ Found user: ${userRecord.displayName || 'N/A'} (${uid})\n`);

    // Collect all kanji from all files
    const allWriteKanji = new Set();
    const allRecogniseKanji = new Set();

    for (const file of markdownFiles) {
      console.log(`📖 Parsing: ${path.basename(file)}`);
      const { write, recognise } = extractKanjiFromMarkdown(file);

      console.log(`   ✍️  Write: ${write.length} kanji`);
      console.log(`   👁️  Recognise: ${recognise.length} kanji`);

      write.forEach(k => allWriteKanji.add(k));
      recognise.forEach(k => allRecogniseKanji.add(k));
    }

    console.log('\n📊 Total kanji extracted:');
    console.log(`   ✍️  Write: ${allWriteKanji.size} unique kanji`);
    console.log(`   👁️  Recognise: ${allRecogniseKanji.size} unique kanji`);
    console.log('');

    // Get current kanji progress
    const kanjiProgressRef = firestore.collection('users').doc(uid).collection('progress').doc('kanji');
    const kanjiProgressDoc = await kanjiProgressRef.get();

    let kanjiData = {};
    if (kanjiProgressDoc.exists) {
      kanjiData = kanjiProgressDoc.data() || {};
      console.log(`📚 Existing kanji in Firebase: ${Object.keys(kanjiData).length}`);
    } else {
      console.log('📚 No existing kanji progress found (will create new document)');
    }

    // Prepare updates
    let newCount = 0;
    let updatedCount = 0;
    const updates = {};

    // Mark "Write" kanji as learned (viewCount=6)
    for (const kanji of allWriteKanji) {
      if (!kanjiData[kanji]) {
        newCount++;
        updates[kanji] = { viewCount: 6, category: 'write' };
      } else {
        updatedCount++;
        // Update existing kanji, preserve viewCount if higher
        const currentViewCount = kanjiData[kanji].viewCount || 0;
        updates[kanji] = {
          viewCount: Math.max(currentViewCount, 6),
          category: 'write'
        };
      }
    }

    // Mark "Recognise" kanji as partially learned (viewCount=3)
    for (const kanji of allRecogniseKanji) {
      if (!kanjiData[kanji]) {
        newCount++;
        updates[kanji] = { viewCount: 3, category: 'recognise' };
      } else {
        updatedCount++;
        // Update existing kanji, preserve viewCount if higher
        const currentViewCount = kanjiData[kanji].viewCount || 0;
        updates[kanji] = {
          viewCount: Math.max(currentViewCount, 3),
          category: 'recognise'
        };
      }
    }

    // Write to Firebase
    console.log('\n💾 Writing to Firebase...');
    await kanjiProgressRef.set(updates, { merge: true });

    console.log('\n✅ Import complete!');
    console.log('━'.repeat(60));
    console.log(`   New kanji added: ${newCount}`);
    console.log(`   Existing kanji updated: ${updatedCount}`);
    console.log(`   Total kanji in collection: ${Object.keys({ ...kanjiData, ...updates }).length}`);
    console.log('━'.repeat(60));
    console.log('');
    console.log('📍 Firebase location:');
    console.log(`   users/${uid}/progress/kanji`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'auth/user-not-found') {
      console.error(`   User not found: ${email}`);
    }
    process.exit(1);
  }
}

// Run the import
importKanji()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
