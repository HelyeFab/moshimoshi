#!/usr/bin/env node
/**
 * Test News Scraper Functions
 * Tests both manual and scheduled news scraping
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'moshimoshi-de237'
  });
}

const db = admin.firestore();

async function getArticleCount() {
  const snapshot = await db.collection('news_articles').get();
  return snapshot.size;
}

async function getRecentArticles(limit = 5) {
  const snapshot = await db.collection('news_articles')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title?.substring(0, 50) + '...',
      source: data.source,
      difficulty: data.difficulty,
      hasAudio: !!data.audioUrl,
      hasFurigana: !!data.titleWithFurigana,
      hasRichContent: !!data.contentWithFurigana,
      sourceId: data.sourceId || 'N/A',
      createdAt: data.createdAt?.toDate?.()?.toISOString() || 'N/A',
      publishDate: data.publishDate?.toDate?.()?.toISOString() || 'N/A'
    };
  });
}

async function testManualScraper() {
  console.log('\n📰 Testing Manual News Scraper...\n');

  // Get count before
  const countBefore = await getArticleCount();
  console.log(`Articles before: ${countBefore}`);

  console.log('\n⏳ Calling manual scraper function...');
  console.log('   (This will take 30-60 seconds due to rate limiting)\n');

  // Import the scraper directly and run it
  const { scheduledNewsScraper } = require('../functions/lib/scheduled/newsScheduler.js');

  try {
    const result = await scheduledNewsScraper();
    console.log('✅ Scraper completed:', result);
  } catch (error) {
    console.error('❌ Scraper failed:', error.message);
    return;
  }

  // Get count after
  const countAfter = await getArticleCount();
  console.log(`\nArticles after: ${countAfter}`);
  console.log(`New articles: ${countAfter - countBefore}`);

  // Show recent articles
  console.log('\n📋 Most Recent Articles:');
  const recent = await getRecentArticles(5);
  recent.forEach((article, i) => {
    console.log(`\n${i + 1}. ${article.title}`);
    console.log(`   Source: ${article.source} | Difficulty: ${article.difficulty}`);
    console.log(`   🎧 Audio: ${article.hasAudio ? 'YES' : 'NO'} | 📖 Furigana: ${article.hasFurigana ? 'YES' : 'NO'} | 🎨 Rich Content: ${article.hasRichContent ? 'YES' : 'NO'}`);
    console.log(`   Source ID: ${article.sourceId}`);
    console.log(`   Created: ${article.createdAt}`);
  });
}

async function checkScheduledFunction() {
  console.log('\n⏰ Checking Scheduled Function Status...\n');
  console.log('The scheduled function runs daily at 6:00 AM JST (UTC 21:00)');
  console.log('Schedule: 0 6 * * * (Asia/Tokyo timezone)');
  console.log('\nTo manually trigger it, use:');
  console.log('  gcloud functions call scheduledNewsScraperFunction --region=us-central1');
  console.log('\nOr via Firebase Console:');
  console.log('  https://console.firebase.google.com/project/moshimoshi-de237/functions/list');
}

async function main() {
  console.log('='.repeat(60));
  console.log('NEWS SCRAPER TEST');
  console.log('='.repeat(60));

  try {
    // Test manual scraper
    await testManualScraper();

    // Show scheduled function info
    await checkScheduledFunction();

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
