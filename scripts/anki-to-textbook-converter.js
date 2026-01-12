/**
 * Convert Anki .apkg decks to Textbook Vocabulary JSON format
 *
 * Usage:
 *   node scripts/anki-to-textbook-converter.js <path-to-apkg> <textbook-id> <textbook-title>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CLI arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('❌ Usage: node scripts/anki-to-textbook-converter.js <apkg-path> <textbook-id> <textbook-title>');
  console.error('\n📖 Example:');
  console.error('   node scripts/anki-to-textbook-converter.js ~/Downloads/Dekiru.apkg dekiru-nihongo "Dekiru Nihongo"');
  process.exit(1);
}

const [apkgPath, textbookId, textbookTitle] = args;

console.log('🚀 Anki to Textbook Converter\n');
console.log(`📁 Input: ${apkgPath}`);
console.log(`📚 Textbook ID: ${textbookId}`);
console.log(`📖 Title: ${textbookTitle}\n`);

// Check if file exists
if (!fs.existsSync(apkgPath)) {
  console.error(`❌ File not found: ${apkgPath}`);
  process.exit(1);
}

// Create temporary TypeScript file with the conversion logic
const tempScript = path.join(__dirname, '_temp_convert.ts');

const scriptContent = `
import { AnkiParser } from '../src/lib/anki/parser';
import * as fs from 'fs';
import * as path from 'path';

const apkgPath = '${apkgPath.replace(/'/g, "\\'")}';
const textbookId = '${textbookId.replace(/'/g, "\\'")}';
const textbookTitle = '${textbookTitle.replace(/'/g, "\\'")}';

async function convert() {
  try {
    // Read file
    console.log('📖 Reading .apkg file...');
    const fileBuffer = fs.readFileSync(apkgPath);

    // Create File-like object
    const { Blob } = await import('buffer');
    const blob = new Blob([fileBuffer]);
    const file = Object.assign(blob, {
      name: path.basename(apkgPath),
      lastModified: Date.now(),
      webkitRelativePath: '',
      arrayBuffer: () => Promise.resolve(fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ))
    });

    // Parse Anki deck
    console.log('🔍 Parsing Anki deck...');
    const result = await AnkiParser.parseApkg(file as any);

    console.log(\`✅ Parsed \${result.cards.length} cards\\n\`);

    // Convert cards to vocabulary format
    const vocabularyItems = result.cards.map((card, index) => {
      const tags = card.tags || [];

      // Extract Japanese and reading
      const japanese = cleanHTML(card.expression || card.front || card.fields[0] || '');
      const reading = cleanHTML(card.reading || card.fields[1] || japanese);
      const meaning = cleanHTML(card.meaning || card.back || card.fields[2] || '');

      // Extract lesson/chapter
      let lesson = undefined;
      let chapter = undefined;

      for (const tag of tags) {
        const lessonMatch = tag.match(/lesson[-_]?(\\d+)/i);
        const chapterMatch = tag.match(/chapter[-_]?(\\d+)/i);
        if (lessonMatch) lesson = parseInt(lessonMatch[1]);
        if (chapterMatch) chapter = parseInt(chapterMatch[1]);
      }

      // Extract JLPT level
      let jlptLevel = 'N5';
      for (const tag of tags) {
        const match = tag.match(/n[1-5]/i);
        if (match) jlptLevel = match[0].toUpperCase();
      }

      return {
        id: \`\${textbookId}-\${index + 1}-\${Date.now()}\`,
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

    console.log(\`🔄 Converted \${vocabularyItems.length} vocabulary items\\n\`);

    // Generate metadata
    const lessonSet = new Set();
    const chapterSet = new Set();
    const jlptDistribution = {};

    vocabularyItems.forEach(item => {
      if (item.lesson) lessonSet.add(item.lesson);
      if (item.chapter) chapterSet.add(item.chapter);
      if (item.jlptLevel) {
        jlptDistribution[item.jlptLevel] = (jlptDistribution[item.jlptLevel] || 0) + 1;
      }
    });

    const metadata = {
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

    // Write files
    fs.writeFileSync(
      path.join(outputDir, 'all.json'),
      JSON.stringify(vocabularyItems, null, 2)
    );
    console.log(\`✅ Wrote all.json (\${vocabularyItems.length} items)\`);

    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    console.log(\`✅ Wrote metadata.json\`);

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
        fs.writeFileSync(
          path.join(outputDir, \`lesson-\${lessonNum}.json\`),
          JSON.stringify(items, null, 2)
        );
        console.log(\`✅ Wrote lesson-\${lessonNum}.json (\${items.length} items)\`);
      });
    }

    console.log('\\n📊 Summary:');
    console.log(\`  - Total vocabulary: \${vocabularyItems.length}\`);
    console.log(\`  - Lessons: \${metadata.lessons?.length || 0}\`);
    console.log(\`  - Chapters: \${metadata.chapters?.length || 0}\`);
    console.log(\`  - JLPT distribution:\`, jlptDistribution);
    console.log(\`\\n✨ Conversion complete!\`);
    console.log(\`\\n📍 Output: \${outputDir}\`);
    console.log(\`\\n⚠️  Next steps:\`);
    console.log(\`  1. Update src/data/textbooks/index.json\`);
    console.log(\`  2. Add to TextbookSelector.tsx textbookInfo\`);
    console.log(\`  3. Review generated data\`);

  } catch (error) {
    console.error('\\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function cleanHTML(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/<br\\s*\\/?>/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\s+/g, ' ')
    .trim();
}

convert();
`;

// Write temp script
fs.writeFileSync(tempScript, scriptContent);

console.log('⚙️  Running converter...\n');

try {
  execSync(`npx ts-node ${tempScript}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  // Cleanup
  fs.unlinkSync(tempScript);

} catch (error) {
  console.error('\n❌ Conversion failed');
  // Cleanup even on error
  if (fs.existsSync(tempScript)) {
    fs.unlinkSync(tempScript);
  }
  process.exit(1);
}
