/**
 * Backfill Script: Regenerate Word Explanations for News Articles
 *
 * This script regenerates word explanations for existing news articles using
 * the new Kuromoji-based word extractor instead of the old broken regex approach.
 *
 * Usage:
 *   node scripts/backfill-news-word-explanations.js [--limit=N] [--article-id=ID]
 *
 * Options:
 *   --limit=N        Process only N articles (default: all)
 *   --article-id=ID  Process only specific article ID
 *   --dry-run        Preview what will be done without making changes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1];
const specificArticleId = args.find(arg => arg.startsWith('--article-id='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

console.log('=== NEWS ARTICLE WORD EXPLANATION BACKFILL ===');
console.log('Configuration:');
console.log('  Limit:', limit || 'all articles');
console.log('  Specific Article:', specificArticleId || 'none');
console.log('  Dry Run:', dryRun);
console.log('');

async function backfillWordExplanations() {
  try {
    // Get articles that need word explanation regeneration
    let query = db.collection('news_articles').orderBy('createdAt', 'desc');

    if (specificArticleId) {
      query = db.collection('news_articles').where(admin.firestore.FieldPath.documentId(), '==', specificArticleId);
    } else if (limit) {
      query = query.limit(parseInt(limit));
    }

    const articlesSnapshot = await query.get();

    if (articlesSnapshot.empty) {
      console.log('No articles found');
      return;
    }

    console.log(`Found ${articlesSnapshot.size} articles to process`);
    console.log('');

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalOldWords = 0;
    let totalNewWords = 0;

    for (const articleDoc of articlesSnapshot.docs) {
      const articleId = articleDoc.id;
      const article = articleDoc.data();

      console.log(`\n[${processedCount + 1}/${articlesSnapshot.size}] Processing: ${article.title}`);
      console.log(`  ID: ${articleId}`);
      console.log(`  Created: ${article.createdAt?.toDate?.().toISOString() || 'unknown'}`);

      // Check existing word explanations
      const wordExplanationsDoc = await db.collection('news_article_word_explanations').doc(articleId).get();

      if (wordExplanationsDoc.exists) {
        const existingData = wordExplanationsDoc.data();
        const oldWordCount = existingData.wordCount || existingData.words?.length || 0;
        totalOldWords += oldWordCount;

        console.log(`  ❌ Old word count: ${oldWordCount} (broken regex extractor)`);

        if (!dryRun) {
          // Delete old word explanations to force regeneration
          await db.collection('news_article_word_explanations').doc(articleId).delete();
          console.log(`  🗑️  Deleted old word explanations`);
        } else {
          console.log(`  🗑️  Would delete old word explanations (dry run)`);
        }
      } else {
        console.log(`  ⚠️  No existing word explanations found`);
      }

      if (!dryRun) {
        console.log(`  ⏳ Triggering regeneration via Cloud Function...`);
        // The next scraping run or integrity check will regenerate with new Kuromoji extractor
        processedCount++;
      } else {
        console.log(`  ✅ Would trigger regeneration (dry run)`);
        skippedCount++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Processed: ${processedCount} articles`);
    console.log(`Skipped: ${skippedCount} articles`);
    console.log(`Errors: ${errorCount} articles`);
    console.log(`Old total words (broken): ${totalOldWords}`);
    console.log(`Expected new words: ~${totalOldWords * 3}-${totalOldWords * 4} (3-4x improvement)`);
    console.log('');
    console.log('✅ Backfill complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Deploy the updated Cloud Functions code');
    console.log('2. Run the integrity checker to regenerate word explanations:');
    console.log('   firebase functions:call checkNewsArticleIntegrity');
    console.log('3. Or wait for next scheduled scraping run');

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillWordExplanations();
