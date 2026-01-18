#!/usr/bin/env node
/**
 * Build script to pre-cache Tatoeba sentences for common kanji
 * Generates static JSON files that can be loaded client-side without runtime search
 *
 * Usage: node scripts/generate-kanji-sentence-cache.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const KANJI_DATA_DIR = path.join(__dirname, '../public/data/kanji');
const TATOEBA_DIR = path.join(__dirname, '../public/data/tatoeba');
const OUTPUT_DIR = path.join(__dirname, '../public/data/kanji-sentences');
const SENTENCES_PER_KANJI = 5;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Load all kanji from JLPT level files
 */
function loadAllKanji() {
  const kanji = new Set();
  const levels = [
    { name: 'N5', file: 'jlpt_5.json' },
    { name: 'N4', file: 'jlpt_4.json' },
    { name: 'N3', file: 'jlpt_3.json' },
    { name: 'N2', file: 'jlpt_2.json' },
    { name: 'N1', file: 'jlpt_1.json' }
  ];

  for (const level of levels) {
    const filePath = path.join(KANJI_DATA_DIR, level.file);

    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.kanji) {
              kanji.add(item.kanji);
            }
          });
        }
        console.log(`✓ Loaded ${data.length} kanji from ${level.name}`);
      } catch (error) {
        console.error(`✗ Failed to load ${level.name}:`, error.message);
      }
    } else {
      console.error(`✗ File not found: ${filePath}`);
    }
  }

  return Array.from(kanji);
}

/**
 * Load Tatoeba metadata
 */
function loadTatoebaMetadata() {
  const metadataPath = path.join(TATOEBA_DIR, 'metadata.json');

  if (!fs.existsSync(metadataPath)) {
    throw new Error('Tatoeba metadata not found. Run tatoeba build script first.');
  }

  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

/**
 * Load an index chunk
 */
function loadIndexChunk(chunkIndex) {
  const indexPath = path.join(TATOEBA_DIR, `index-${chunkIndex}.json`);

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
}

/**
 * Load an example chunk
 */
function loadExampleChunk(chunkIndex) {
  const examplesPath = path.join(TATOEBA_DIR, `examples-${chunkIndex}.json`);

  if (!fs.existsSync(examplesPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
}

/**
 * Search for sentences containing a specific kanji
 */
function searchSentencesForKanji(kanji, metadata, limit = SENTENCES_PER_KANJI) {
  const examples = [];
  const seenIds = new Set();

  // Search through index chunks
  for (let i = 0; i < metadata.totalIndexChunks && examples.length < limit; i++) {
    const indexChunk = loadIndexChunk(i);
    if (!indexChunk) continue;

    // Check if this chunk has the kanji
    if (indexChunk[kanji]) {
      const exampleIndices = indexChunk[kanji];

      // Load the corresponding examples
      for (const exampleIndex of exampleIndices) {
        if (examples.length >= limit) break;

        const chunkIndex = Math.floor(exampleIndex / metadata.chunkSize);
        const localIndex = exampleIndex % metadata.chunkSize;

        const exampleChunk = loadExampleChunk(chunkIndex);
        if (!exampleChunk) continue;

        const example = exampleChunk[localIndex];

        if (example && !seenIds.has(example.id)) {
          examples.push({
            id: example.id,
            japanese: example.japanese,
            english: example.english
          });
          seenIds.add(example.id);
        }
      }
    }
  }

  return examples;
}

/**
 * Simple hash function to generate consistent IDs
 */
function hashKanji(kanji) {
  let hash = 0;
  for (let i = 0; i < kanji.length; i++) {
    const char = kanji.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate cache file for a kanji
 */
function generateKanjiCache(kanji, metadata, index) {
  const sentences = searchSentencesForKanji(kanji, metadata);

  return {
    kanji,
    sentences,
    generatedAt: new Date().toISOString(),
    count: sentences.length,
    fileId: `kanji-${index.toString().padStart(5, '0')}`
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Kanji Sentence Cache Generation\n');

  // Load all kanji
  console.log('📚 Loading kanji from JLPT data...');
  const allKanji = loadAllKanji();
  console.log(`✓ Found ${allKanji.length} unique kanji\n`);

  // Load Tatoeba metadata
  console.log('📖 Loading Tatoeba metadata...');
  const metadata = loadTatoebaMetadata();
  console.log(`✓ Metadata loaded: ${metadata.totalExamples} examples in ${metadata.totalIndexChunks} chunks\n`);

  // Generate caches
  console.log('⚙️  Generating sentence caches...');
  let cachedCount = 0;
  let skippedCount = 0;
  const startTime = Date.now();

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalKanji: allKanji.length,
    sentencesPerKanji: SENTENCES_PER_KANJI,
    kanji: {}
  };

  for (let i = 0; i < allKanji.length; i++) {
    const kanji = allKanji[i];

    try {
      const cache = generateKanjiCache(kanji, metadata, i);

      // Save individual cache file with simple numeric filename
      const fileName = `${cache.fileId}.json`;
      const outputPath = path.join(OUTPUT_DIR, fileName);
      fs.writeFileSync(outputPath, JSON.stringify(cache, null, 2));

      // Add to manifest
      manifest.kanji[kanji] = {
        file: fileName,
        fileId: cache.fileId,
        count: cache.count
      };

      if (cache.count > 0) {
        cachedCount++;
      } else {
        skippedCount++;
      }

      // Progress indicator
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${allKanji.length} (${cachedCount} cached, ${skippedCount} no sentences)`);
      }

    } catch (error) {
      console.error(`  ✗ Error processing ${kanji}:`, error.message);
      skippedCount++;
    }
  }

  // Save manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n✅ Cache Generation Complete!');
  console.log(`   Total kanji: ${allKanji.length}`);
  console.log(`   Cached with sentences: ${cachedCount}`);
  console.log(`   No sentences found: ${skippedCount}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Output directory: ${OUTPUT_DIR}`);
  console.log(`   Manifest: ${manifestPath}`);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
