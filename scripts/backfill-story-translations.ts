/**
 * Backfill Story Translations
 *
 * This script adds English translations to stories that are missing them.
 * It uses OpenAI to generate translations for each page.
 *
 * Usage:
 *   npx tsx scripts/backfill-story-translations.ts [--dry-run] [--limit=N] [--story-id=ID]
 *
 * Options:
 *   --dry-run     Preview changes without saving
 *   --limit=N     Process only N stories (default: all)
 *   --story-id=ID Process only a specific story
 */

import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Initialize Firebase
if (!admin.apps.length) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require('../moshimoshi-service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.warn('No service account file found, using application default credentials');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

const db = admin.firestore();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const storyIdArg = args.find(a => a.startsWith('--story-id='));
const specificStoryId = storyIdArg ? storyIdArg.split('=')[1] : null;

interface StoryPage {
  text?: string;
  translation?: string;
  textEn?: string;
}

interface StoryData {
  title?: string;
  titleJa?: string;
  jlptLevel?: string;
  pages?: StoryPage[];
  updatedAt?: admin.firestore.FieldValue;
}

interface ProcessResult {
  skipped?: boolean;
  reason?: string;
  success?: boolean;
  translatedPages?: number;
  totalPages?: number;
}

/**
 * Translate Japanese text to English using OpenAI
 */
async function translateText(japaneseText: string, jlptLevel: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a Japanese-English translator. Translate the following Japanese text to natural, fluent English. This is from a ${jlptLevel} level Japanese learning story, so keep the translation clear and educational. Return ONLY the English translation, nothing else.`
        },
        {
          role: 'user',
          content: japaneseText
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return response.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('Translation error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Process a single story
 */
async function processStory(storyDoc: admin.firestore.DocumentSnapshot): Promise<ProcessResult> {
  const storyId = storyDoc.id;
  const data = storyDoc.data() as StoryData;

  console.log(`\n📖 Processing: ${data.title || data.titleJa} (${storyId})`);
  console.log(`   JLPT Level: ${data.jlptLevel}`);
  console.log(`   Pages: ${data.pages?.length || 0}`);

  if (!data.pages || data.pages.length === 0) {
    console.log('   ⚠️  No pages found, skipping');
    return { skipped: true, reason: 'no_pages' };
  }

  // Check which pages need translation
  const pagesToTranslate: Array<{ index: number; page: StoryPage }> = [];
  data.pages.forEach((page, index) => {
    const hasTranslation = page.translation && page.translation.trim().length > 0;
    if (!hasTranslation && page.text) {
      pagesToTranslate.push({ index, page });
    }
  });

  if (pagesToTranslate.length === 0) {
    console.log('   ✅ All pages already have translations');
    return { skipped: true, reason: 'already_translated' };
  }

  console.log(`   📝 Pages needing translation: ${pagesToTranslate.length}`);

  // Translate each page
  const updatedPages = [...data.pages];
  let translatedCount = 0;

  for (const { index, page } of pagesToTranslate) {
    console.log(`   🔄 Translating page ${index + 1}...`);

    if (dryRun) {
      console.log(`      [DRY RUN] Would translate: "${page.text?.substring(0, 50)}..."`);
      continue;
    }

    try {
      const translation = await translateText(page.text || '', data.jlptLevel || 'N5');
      updatedPages[index] = {
        ...updatedPages[index],
        translation: translation
      };
      translatedCount++;
      console.log(`      ✅ Translated: "${translation.substring(0, 50)}..."`);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.log(`      ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Save updates
  if (!dryRun && translatedCount > 0) {
    console.log(`   💾 Saving ${translatedCount} translations...`);
    await db.collection('stories').doc(storyId).update({
      pages: updatedPages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✅ Saved!');
  }

  return {
    success: true,
    translatedPages: translatedCount,
    totalPages: data.pages.length
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Story Translation Backfill Script');
  console.log('====================================');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be saved\n');
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable not set');
    console.log('   Run: export OPENAI_API_KEY=your-key-here');
    process.exit(1);
  }

  if (specificStoryId) {
    console.log(`📌 Processing specific story: ${specificStoryId}\n`);
    const storyDoc = await db.collection('stories').doc(specificStoryId).get();
    if (!storyDoc.exists) {
      console.error(`❌ Story not found: ${specificStoryId}`);
      process.exit(1);
    }
    await processStory(storyDoc);
    return;
  }

  let query: admin.firestore.Query = db.collection('stories').orderBy('createdAt', 'desc');

  if (limit) {
    console.log(`📊 Limiting to ${limit} stories\n`);
    query = query.limit(limit);
  }

  const snapshot = await query.get();
  console.log(`📚 Found ${snapshot.size} stories to check\n`);

  const stats = {
    processed: 0,
    translated: 0,
    skipped: 0,
    failed: 0,
    pagesTranslated: 0,
  };

  for (const doc of snapshot.docs) {
    try {
      const result = await processStory(doc);
      stats.processed++;

      if (result.skipped) {
        stats.skipped++;
      } else if (result.success) {
        stats.translated++;
        stats.pagesTranslated += result.translatedPages || 0;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      stats.failed++;
    }
  }

  console.log('\n====================================');
  console.log('📊 Summary');
  console.log('====================================');
  console.log(`   Stories processed: ${stats.processed}`);
  console.log(`   Stories translated: ${stats.translated}`);
  console.log(`   Stories skipped: ${stats.skipped}`);
  console.log(`   Stories failed: ${stats.failed}`);
  console.log(`   Total pages translated: ${stats.pagesTranslated}`);

  if (dryRun) {
    console.log('\n🔍 This was a DRY RUN - no changes were saved');
    console.log('   Run without --dry-run to apply changes');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
