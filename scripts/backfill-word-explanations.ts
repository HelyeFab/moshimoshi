/**
 * Backfill Word Explanations Script
 *
 * Re-runs prefetch for all existing content (articles, books, stories, comics)
 * with the new 1000-word limit. The system will automatically:
 * 1. Detect existing words (old 400-word limit)
 * 2. Generate only missing words (new 600)
 * 3. Merge to get full 1000 words
 *
 * Usage:
 *   npx tsx scripts/backfill-word-explanations.ts
 *
 * Options:
 *   --dry-run       Show what would be processed without making changes
 *   --limit=N       Process only N items per collection (for testing)
 *   --type=TYPE     Process only one type (article, book, story, comic)
 *   --id=ID         Process only a specific content item by ID
 */

const admin = require('firebase-admin');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

console.log('🔑 Checking environment variables...');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Configured' : '❌ Missing');
console.log('  MODAL_API_KEY:', process.env.MODAL_API_KEY ? '✓ Configured' : '❌ Missing');
console.log('');

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY not found in .env.local');
  console.error('Please add your OpenAI API key to .env.local');
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = require(path.join(process.cwd(), 'moshimoshi-service-account.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const typeArg = args.find(arg => arg.startsWith('--type='));
const contentType = typeArg ? typeArg.split('=')[1] : null;
const idArg = args.find(arg => arg.startsWith('--id='));
const contentId = idArg ? idArg.split('=')[1] : null;

// Content type configurations
const CONTENT_TYPES = [
  {
    type: 'article',
    collection: 'news_articles',
    textField: 'content', // Field containing the text to analyze
    idField: 'id',
  },
  {
    type: 'book',
    collection: 'books',
    textField: 'content',
    idField: 'id',
  },
  {
    type: 'story',
    collection: 'stories',
    textField: 'pages', // Array of pages with text
    idField: 'id',
  },
  {
    type: 'comic',
    collection: 'comics',
    textField: 'panels', // Array of panels with dialogues
    idField: 'id',
  },
];

// Filter by type if specified
const typesToProcess = contentType
  ? CONTENT_TYPES.filter(t => t.type === contentType)
  : CONTENT_TYPES;

if (contentType && typesToProcess.length === 0) {
  console.error(`❌ Invalid content type: ${contentType}`);
  console.error(`Valid types: ${CONTENT_TYPES.map(t => t.type).join(', ')}`);
  process.exit(1);
}

// Stats tracking
const stats = {
  total: 0,
  processed: 0,
  skipped: 0,
  errors: 0,
  wordsGenerated: 0,
  wordsCached: 0,
  wordsSkipped: 0,
};

/**
 * Extract text from content based on type
 */
function extractText(contentDoc, config) {
  const data = contentDoc.data();

  if (!data) return null;

  switch (config.type) {
    case 'article':
    case 'book':
      return data[config.textField] || null;

    case 'story':
      // Extract text from all pages
      const pages = data[config.textField];
      if (!Array.isArray(pages)) return null;
      return pages
        .map(page => page.text || page.content || '')
        .filter(Boolean)
        .join('\n');

    case 'comic':
      // Extract text from all panels and dialogues
      const panels = data[config.textField];
      if (!Array.isArray(panels)) return null;
      return panels
        .flatMap(panel => {
          const texts = [];
          if (panel.narration?.textJa) texts.push(panel.narration.textJa);
          if (Array.isArray(panel.dialogues)) {
            texts.push(...panel.dialogues.map(d => d.textJa).filter(Boolean));
          }
          return texts;
        })
        .filter(Boolean)
        .join(' ');

    default:
      return null;
  }
}

/**
 * Call the precompute function directly (server-side)
 */
async function precomputeWords(contentId: string, contentType: string, text: string) {
  try {
    // Import precompute directly
    const { precomputeWordExplanations } = await import('../src/lib/ai/precompute/wordPrecompute.js');

    // Split into chunks if text is too large
    const MAX_CHUNK_SIZE = 20000;
    const chunks = [];

    if (text.length <= MAX_CHUNK_SIZE) {
      chunks.push(text);
    } else {
      // Split into chunks
      for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
        chunks.push(text.slice(i, i + MAX_CHUNK_SIZE));
      }
    }

    console.log(`   📦 Processing ${chunks.length} chunk(s)...`);

    let totalGenerated = 0;
    let totalCached = 0;
    let totalSkipped = 0;

    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];

      console.log(`      Chunk ${idx + 1}/${chunks.length} (${chunk.length} chars)...`);

      const result = await precomputeWordExplanations({
        contentId,
        contentType,
        text: chunk,
        limit: 1000,
        chunkIndex: idx,
      });

      totalGenerated += result.generated || 0;
      totalCached += result.cached || 0;
      totalSkipped += result.skipped || 0;

      console.log(`      ✓ Generated: ${result.generated}, Cached: ${result.cached}, Skipped: ${result.skipped}`);
    }

    return {
      success: true,
      generated: totalGenerated,
      cached: totalCached,
      skipped: totalSkipped,
      total: totalGenerated + totalCached + totalSkipped,
    };
  } catch (error) {
    console.error(`      ❌ Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process a single content type
 */
async function processContentType(config) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📚 Processing ${config.type.toUpperCase()}S from "${config.collection}"`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Fetch all content
    let snapshot;

    if (contentId) {
      // Fetch specific document by ID
      const doc = await db.collection(config.collection).doc(contentId).get();
      snapshot = { docs: doc.exists ? [doc] : [], size: doc.exists ? 1 : 0 };
    } else {
      // Fetch all or limited documents
      let query = db.collection(config.collection);

      if (limit) {
        query = query.limit(limit);
      }

      snapshot = await query.get();
    }
    const total = snapshot.size;

    console.log(`Found ${total} ${config.type}(s)\n`);

    if (total === 0) {
      console.log(`⚠️  No ${config.type}s found in collection\n`);
      return;
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const contentId = doc.id;
      const data = doc.data();

      processed++;
      console.log(`[${processed}/${total}] Processing ${config.type}: ${contentId}`);
      console.log(`   Title: ${data.title || data.name || 'Untitled'}`);

      // Extract text
      const text = extractText(doc, config);

      if (!text || text.trim().length === 0) {
        console.log(`   ⚠️  Skipped (no text content)\n`);
        skipped++;
        stats.skipped++;
        continue;
      }

      console.log(`   📄 Text length: ${text.length} characters`);

      if (dryRun) {
        console.log(`   🔍 DRY RUN - Would process this ${config.type}\n`);
        continue;
      }

      // Call precompute
      const result = await precomputeWords(contentId, config.type, text);

      if (result.success) {
        stats.wordsGenerated += result.generated || 0;
        stats.wordsCached += result.cached || 0;
        stats.wordsSkipped += result.skipped || 0;
        console.log(`   ✅ Success! Total words: ${result.total}\n`);
      } else {
        errors++;
        stats.errors++;
        console.log(`   ❌ Failed: ${result.error}\n`);
      }

      // Add delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✓ ${config.type.toUpperCase()}S Summary:`);
    console.log(`  Total: ${total}`);
    console.log(`  Processed: ${processed}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);

    stats.total += total;
    stats.processed += processed;

  } catch (error) {
    console.error(`❌ Error processing ${config.type}s:`, error);
    stats.errors++;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         Word Explanations Backfill Script                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (limit) {
    console.log(`⚠️  LIMIT MODE - Processing only ${limit} items per collection\n`);
  }

  if (contentType) {
    console.log(`📌 TYPE FILTER - Processing only: ${contentType}\n`);
  }

  const startTime = Date.now();

  // Process each content type
  for (const config of typesToProcess) {
    await processContentType(config);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL SUMMARY                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`Total content items:     ${stats.total}`);
  console.log(`Successfully processed:  ${stats.processed}`);
  console.log(`Skipped (no text):       ${stats.skipped}`);
  console.log(`Errors:                  ${stats.errors}`);
  console.log(`\nWords generated:         ${stats.wordsGenerated}`);
  console.log(`Words cached (reused):   ${stats.wordsCached}`);
  console.log(`Words skipped (existed): ${stats.wordsSkipped}`);
  console.log(`\nTime taken:              ${duration} minutes`);

  if (!dryRun) {
    const estimatedCost = (stats.wordsGenerated * 0.002).toFixed(2);
    console.log(`Estimated API cost:      $${estimatedCost}`);
  }

  console.log('\n✅ Backfill complete!\n');

  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
