/**
 * Convert Anki .apkg decks to Textbook Vocabulary JSON format
 *
 * Usage:
 *   npx ts-node scripts/convert-anki-to-textbook.ts <path-to-apkg> <textbook-id> <textbook-title>
 *
 * Example:
 *   npx ts-node scripts/convert-anki-to-textbook.ts ~/Downloads/Dekiru_Nihongo.apkg dekiru-nihongo "Dekiru Nihongo"
 */

import { AnkiParser, ProcessedCard } from '../src/lib/anki/parser';
import * as fs from 'fs';
import * as path from 'path';

interface VocabularyItem {
  id: string;
  japanese: string;
  reading: string;
  meaning: string;
  jlptLevel?: string;
  partOfSpeech?: string[];
  examples?: Array<{
    japanese: string;
    reading: string;
    english: string;
  }>;
  tags: string[];
  lesson?: number;
  chapter?: number;
  textbook: string;
}

interface TextbookMetadata {
  title: string;
  totalCards: number;
  lessons?: number[];
  chapters?: number[];
  jlptDistribution?: Record<string, number>;
  partOfSpeechDistribution?: Record<string, number>;
  source: string;
  importDate: string;
}

/**
 * Extract lesson/chapter number from tags or fields
 */
function extractLessonChapter(card: ProcessedCard, tags: string[]): { lesson?: number; chapter?: number } {
  const result: { lesson?: number; chapter?: number } = {};

  // Check tags for lesson/chapter patterns
  for (const tag of tags) {
    const lessonMatch = tag.match(/lesson[-_]?(\d+)/i);
    const chapterMatch = tag.match(/chapter[-_]?(\d+)/i);

    if (lessonMatch) {
      result.lesson = parseInt(lessonMatch[1]);
    }
    if (chapterMatch) {
      result.chapter = parseInt(chapterMatch[1]);
    }
  }

  // If not found in tags, try to extract from fields
  if (!result.lesson && !result.chapter) {
    const allText = card.fields.join(' ');
    const lessonMatch = allText.match(/L(\d+)|Lesson\s*(\d+)/i);
    if (lessonMatch) {
      result.lesson = parseInt(lessonMatch[1] || lessonMatch[2]);
    }
  }

  return result;
}

/**
 * Extract JLPT level from tags or detect from content
 */
function extractJLPTLevel(tags: string[]): string {
  for (const tag of tags) {
    const match = tag.match(/n[1-5]/i);
    if (match) {
      return match[0].toUpperCase();
    }
  }
  return 'N5'; // Default
}

/**
 * Clean HTML tags and extract plain text
 */
function cleanHTML(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract Japanese and reading from Anki card
 */
function extractJapaneseAndReading(card: ProcessedCard): { japanese: string; reading: string } {
  // Try specific fields first
  if (card.expression && card.reading) {
    return {
      japanese: cleanHTML(card.expression),
      reading: cleanHTML(card.reading)
    };
  }

  // Try field indices (common patterns)
  const fields = card.fields.map(f => cleanHTML(f));

  // Pattern 1: Field 0 = Expression, Field 1 = Reading
  if (fields.length >= 2 && fields[0] && fields[1]) {
    return {
      japanese: fields[0],
      reading: fields[1]
    };
  }

  // Pattern 2: Front has Japanese, extract reading from back
  const frontText = cleanHTML(card.front);
  const hasKanji = /[\u4e00-\u9faf]/.test(frontText);

  if (hasKanji) {
    // Front has kanji, try to find hiragana/katakana version
    const backText = cleanHTML(card.back);
    const hiraganaMatch = backText.match(/[ぁ-ん]+/);

    return {
      japanese: frontText,
      reading: hiraganaMatch ? hiraganaMatch[0] : frontText
    };
  }

  return {
    japanese: frontText,
    reading: frontText
  };
}

/**
 * Extract meaning/definition
 */
function extractMeaning(card: ProcessedCard): string {
  if (card.meaning) {
    return cleanHTML(card.meaning);
  }

  // Try back field
  const backText = cleanHTML(card.back);

  // If back contains English, use it
  const englishMatch = backText.match(/[a-zA-Z][a-zA-Z\s,;]+/);
  if (englishMatch) {
    return englishMatch[0].trim();
  }

  // Try fields (meaning often in field 2 or 3)
  if (card.fields.length >= 3) {
    const potentialMeaning = cleanHTML(card.fields[2]);
    if (/[a-zA-Z]/.test(potentialMeaning)) {
      return potentialMeaning;
    }
  }

  return backText;
}

/**
 * Convert Anki ProcessedCard to VocabularyItem
 */
function convertCard(card: ProcessedCard, textbookId: string): VocabularyItem {
  const tags = card.tags || [];
  const { japanese, reading } = extractJapaneseAndReading(card);
  const meaning = extractMeaning(card);
  const jlptLevel = extractJLPTLevel(tags);
  const { lesson, chapter } = extractLessonChapter(card, tags);

  // Extract examples from fields or sentence fields
  const examples: Array<{ japanese: string; reading: string; english: string }> = [];

  if (card.sentence && card.sentenceMeaning) {
    examples.push({
      japanese: cleanHTML(card.sentence),
      reading: cleanHTML(card.sentenceReading || card.sentence),
      english: cleanHTML(card.sentenceMeaning)
    });
  }

  return {
    id: `${textbookId}-${card.id}`,
    japanese,
    reading,
    meaning,
    jlptLevel,
    partOfSpeech: [], // Could be enhanced if Anki deck has this info
    examples: examples.length > 0 ? examples : undefined,
    tags: [...tags, jlptLevel.toLowerCase(), textbookId],
    lesson,
    chapter,
    textbook: textbookId
  };
}

/**
 * Main conversion function
 */
async function convertAnkiToTextbook(
  apkgPath: string,
  textbookId: string,
  textbookTitle: string
) {
  console.log('🚀 Starting Anki to Textbook conversion...\n');
  console.log(`📁 Input: ${apkgPath}`);
  console.log(`📚 Textbook ID: ${textbookId}`);
  console.log(`📖 Title: ${textbookTitle}\n`);

  // Read .apkg file
  const fileBuffer = fs.readFileSync(apkgPath);
  console.log('✅ File loaded');

  // Convert to File-like object for parser (Node.js compatible)
  const { Blob } = await import('buffer');
  const blob = new Blob([fileBuffer]);
  const file = Object.assign(blob, {
    name: path.basename(apkgPath),
    lastModified: Date.now(),
    webkitRelativePath: '',
    arrayBuffer: () => Promise.resolve(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength))
  }) as unknown as File;

  console.log('🔍 Parsing Anki deck...');
  const parseResult = await AnkiParser.parseApkg(file);

  console.log(`✅ Parsed ${parseResult.cards.length} cards\n`);

  // Convert cards to vocabulary items
  console.log('🔄 Converting cards to vocabulary format...');
  const vocabularyItems = parseResult.cards
    .map(card => convertCard(card, textbookId))
    .filter(item => item.japanese && item.meaning); // Filter out invalid items

  console.log(`✅ Converted ${vocabularyItems.length} vocabulary items\n`);

  // Generate metadata
  const lessonSet = new Set<number>();
  const chapterSet = new Set<number>();
  const jlptDistribution: Record<string, number> = {};

  vocabularyItems.forEach(item => {
    if (item.lesson) lessonSet.add(item.lesson);
    if (item.chapter) chapterSet.add(item.chapter);
    if (item.jlptLevel) {
      jlptDistribution[item.jlptLevel] = (jlptDistribution[item.jlptLevel] || 0) + 1;
    }
  });

  const metadata: TextbookMetadata = {
    title: textbookTitle,
    totalCards: vocabularyItems.length,
    lessons: lessonSet.size > 0 ? Array.from(lessonSet).sort((a, b) => a - b) : undefined,
    chapters: chapterSet.size > 0 ? Array.from(chapterSet).sort((a, b) => a - b) : undefined,
    jlptDistribution,
    partOfSpeechDistribution: {},
    source: 'Anki deck converter',
    importDate: new Date().toISOString()
  };

  // Create output directory
  const outputDir = path.join(__dirname, '..', 'src', 'data', 'textbooks', textbookId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write all.json
  const allJsonPath = path.join(outputDir, 'all.json');
  fs.writeFileSync(allJsonPath, JSON.stringify(vocabularyItems, null, 2));
  console.log(`✅ Wrote all.json (${vocabularyItems.length} items)`);

  // Write metadata.json
  const metadataPath = path.join(outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`✅ Wrote metadata.json`);

  // Write per-lesson files if lessons exist
  if (lessonSet.size > 0) {
    const lessonGroups = new Map<number, VocabularyItem[]>();
    vocabularyItems.forEach(item => {
      if (item.lesson) {
        if (!lessonGroups.has(item.lesson)) {
          lessonGroups.set(item.lesson, []);
        }
        lessonGroups.get(item.lesson)!.push(item);
      }
    });

    lessonGroups.forEach((items, lessonNum) => {
      const lessonPath = path.join(outputDir, `lesson-${lessonNum}.json`);
      fs.writeFileSync(lessonPath, JSON.stringify(items, null, 2));
      console.log(`✅ Wrote lesson-${lessonNum}.json (${items.length} items)`);
    });
  }

  console.log('\n📊 Summary:');
  console.log(`  - Total vocabulary: ${vocabularyItems.length}`);
  console.log(`  - Lessons: ${metadata.lessons?.length || 0}`);
  console.log(`  - Chapters: ${metadata.chapters?.length || 0}`);
  console.log(`  - JLPT distribution:`, jlptDistribution);
  console.log(`\n✨ Conversion complete!`);
  console.log(`\n📍 Output directory: ${outputDir}`);
  console.log(`\n⚠️  Next steps:`);
  console.log(`  1. Update src/data/textbooks/index.json`);
  console.log(`  2. Add textbook info to TextbookSelector.tsx textbookInfo`);
  console.log(`  3. Review generated data for accuracy`);
}

// CLI usage
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: npx ts-node scripts/convert-anki-to-textbook.ts <apkg-path> <textbook-id> <textbook-title>');
  console.error('\nExample:');
  console.error('  npx ts-node scripts/convert-anki-to-textbook.ts ~/Downloads/Dekiru.apkg dekiru-nihongo "Dekiru Nihongo"');
  process.exit(1);
}

const [apkgPath, textbookId, textbookTitle] = args;

convertAnkiToTextbook(apkgPath, textbookId, textbookTitle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
