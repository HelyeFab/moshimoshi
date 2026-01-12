/**
 * Simple Anki .apkg to JSON converter
 * Pure JavaScript - no TypeScript compilation needed
 *
 * Usage: node scripts/anki-deck-to-json.mjs <apkg-path> <textbook-id> <title>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const initSqlJs = require('sql.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI args
const [,, apkgPath, textbookId, textbookTitle] = process.argv;

if (!apkgPath || !textbookId || !textbookTitle) {
  console.error('❌ Usage: node scripts/anki-deck-to-json.mjs <apkg-path> <textbook-id> <title>');
  console.error('\n📖 Example:');
  console.error('   node scripts/anki-deck-to-json.mjs ~/Downloads/Dekiru.apkg dekiru-nihongo "Dekiru Nihongo"');
  process.exit(1);
}

console.log('🚀 Anki to Textbook JSON Converter\n');
console.log(`📁 Input: ${apkgPath}`);
console.log(`📚 ID: ${textbookId}`);
console.log(`📖 Title: ${textbookTitle}\n`);

if (!existsSync(apkgPath)) {
  console.error(`❌ File not found: ${apkgPath}`);
  process.exit(1);
}

// Clean HTML tags
function cleanHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract lesson/chapter from tags
function extractLessonChapter(tags) {
  const result = {};
  for (const tag of tags) {
    const lessonMatch = tag.match(/lesson[-_]?(\d+)/i);
    const chapterMatch = tag.match(/chapter[-_]?(\d+)/i);
    if (lessonMatch) result.lesson = parseInt(lessonMatch[1]);
    if (chapterMatch) result.chapter = parseInt(chapterMatch[1]);
  }
  return result;
}

// Extract JLPT level from tags
function extractJLPTLevel(tags) {
  for (const tag of tags) {
    const match = tag.match(/n[1-5]/i);
    if (match) return match[0].toUpperCase();
  }
  return 'N5';
}

// Extract reading from furigana brackets and clean Japanese text
function processFurigana(text) {
  if (!text) return { japanese: '', reading: '' };

  // Extract readings from brackets: 温[おん]泉[せん] -> おんせん
  const readings = [];
  const readingMatches = text.matchAll(/\[([^\]]+)\]/g);
  for (const match of readingMatches) {
    readings.push(match[1]);
  }

  // Remove brackets to get clean Japanese: 温[おん]泉[せん] -> 温泉
  const japanese = text.replace(/\[([^\]]+)\]/g, '');

  // Join readings
  const reading = readings.length > 0 ? readings.join('') : japanese;

  return { japanese, reading };
}

async function convertAnkiDeck() {
  try {
    // Read and unzip .apkg file
    console.log('📖 Reading .apkg file...');
    const fileBuffer = readFileSync(apkgPath);
    const zip = await JSZip.loadAsync(fileBuffer);

    // Get collection database
    let collectionFile = zip.file('collection.anki21');
    if (!collectionFile) {
      collectionFile = zip.file('collection.anki2');
    }

    if (!collectionFile) {
      throw new Error('No collection database found in .apkg file');
    }

    console.log('🔍 Parsing Anki database...');
    const collectionData = await collectionFile.async('uint8array');

    // Initialize SQL.js and load database
    const SQL = await initSqlJs();
    const db = new SQL.Database(collectionData);

    // Query notes
    const notesResult = db.exec(`
      SELECT id, flds, tags
      FROM notes
    `);

    if (!notesResult || notesResult.length === 0) {
      throw new Error('No notes found in deck');
    }

    const notes = notesResult[0].values;
    console.log(`✅ Found ${notes.length} notes\\n`);

    // Convert notes to vocabulary items
    const vocabularyItems = notes.map((note, index) => {
      const [id, fields, tagsStr] = note;
      const fieldList = String(fields).split('\x1f'); // Anki field separator
      const tags = tagsStr ? String(tagsStr).split(' ').filter(t => t) : [];

      // Process furigana from field 0 (e.g., "温[おん]泉[せん]")
      const field0 = cleanHTML(fieldList[0] || '');
      const { japanese, reading } = processFurigana(field0);

      // Field 1 is the English meaning
      const meaning = cleanHTML(fieldList[1] || '');

      const { lesson, chapter } = extractLessonChapter(tags);
      const jlptLevel = extractJLPTLevel(tags);

      return {
        id: `${textbookId}-${index + 1}-${Date.now()}`,
        japanese,
        reading,
        meaning,
        jlptLevel,
        partOfSpeech: [],
        examples: [],
        tags: [...tags, jlptLevel.toLowerCase(), textbookId],
        lesson,
        chapter,
        textbook: textbookId
      };
    }).filter(item => item.japanese && item.meaning);

    console.log(`🔄 Converted ${vocabularyItems.length} items\\n`);

    // Generate metadata
    const lessonSet = new Set();
    const chapterSet = new Set();
    const jlptDistribution = {};

    vocabularyItems.forEach(item => {
      if (item.lesson) lessonSet.add(item.lesson);
      if (item.chapter) chapterSet.add(item.chapter);
      jlptDistribution[item.jlptLevel] = (jlptDistribution[item.jlptLevel] || 0) + 1;
    });

    const metadata = {
      title: textbookTitle,
      totalCards: vocabularyItems.length,
      lessons: lessonSet.size > 0 ? Array.from(lessonSet).sort((a, b) => a - b) : undefined,
      chapters: chapterSet.size > 0 ? Array.from(chapterSet).sort((a, b) => a - b) : undefined,
      jlptDistribution,
      partOfSpeechDistribution: {},
      source: 'Anki deck converter (MJS)',
      importDate: new Date().toISOString()
    };

    // Create output directory
    const outputDir = join(__dirname, '..', 'src', 'data', 'textbooks', textbookId);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write files
    writeFileSync(
      join(outputDir, 'all.json'),
      JSON.stringify(vocabularyItems, null, 2)
    );
    console.log(`✅ Wrote all.json (${vocabularyItems.length} items)`);

    writeFileSync(
      join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    console.log(`✅ Wrote metadata.json`);

    // Write per-lesson files
    if (lessonSet.size > 0) {
      const lessonGroups = new Map();
      vocabularyItems.forEach(item => {
        if (item.lesson) {
          if (!lessonGroups.has(item.lesson)) {
            lessonGroups.set(item.lesson, []);
          }
          lessonGroups.get(item.lesson).push(item);
        }
      });

      lessonGroups.forEach((items, lessonNum) => {
        writeFileSync(
          join(outputDir, `lesson-${lessonNum}.json`),
          JSON.stringify(items, null, 2)
        );
        console.log(`✅ Wrote lesson-${lessonNum}.json (${items.length} items)`);
      });
    }

    console.log('\n📊 Summary:');
    console.log(`  - Total: ${vocabularyItems.length}`);
    console.log(`  - Lessons: ${metadata.lessons?.length || 0}`);
    console.log(`  - Chapters: ${metadata.chapters?.length || 0}`);
    console.log(`  - JLPT:`, jlptDistribution);
    console.log(`\n✨ Complete!`);
    console.log(`\n📍 Output: ${outputDir}`);
    console.log(`\n⚠️  Next steps:`);
    console.log(`  1. Update src/data/textbooks/index.json`);
    console.log(`  2. Add to TextbookSelector.tsx textbookInfo`);
    console.log(`  3. Preview: ${basename(outputDir)}`);

    db.close();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

convertAnkiDeck();
