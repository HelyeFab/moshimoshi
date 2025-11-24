/**
 * Direct test of NHK Easy scraper with TTS audio generation
 * This bypasses Firebase Functions and tests the core logic directly
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('../service-account-key.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

// Set the KOKORO API key as environment variable for testing
process.env.KOKORO_API_KEY = 'e7651e66-9c78-4b74-a771-5626ca99409e';

console.log('🚀 Testing NHK Easy Scraper with TTS Audio Generation\n');
console.log('📋 Configuration:');
console.log('  - Source: NHK Easy');
console.log('  - TTS Provider: Kokoro (Sheldon server)');
console.log('  - Storage: Firebase Storage');
console.log('  - Database: Firestore\n');

try {
  // Import the scraper (compiled JS version)
  const { scrapeNHKEasy } = await import('./lib/scrapers/nhkEasyScraper.js');

  console.log('⏳ Running scraper (this may take 1-2 minutes for TTS generation)...\n');
  const startTime = Date.now();

  const result = await scrapeNHKEasy();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (result.success) {
    console.log(`\n✅ Scraping completed successfully in ${duration}s`);
    console.log(`📰 Articles scraped: ${result.articles.length}`);

    // Show details of first article
    if (result.articles.length > 0) {
      const article = result.articles[0];
      console.log('\n📄 Sample Article:');
      console.log('  Title:', article.title.substring(0, 50) + '...');
      console.log('  ID:', article.id);
      console.log('  Source:', article.source);
      console.log('  Audio Status:', article.audioStatus || 'N/A');

      if (article.generatedTitleAudioUrl) {
        console.log('\n🔊 TTS Audio Generated:');
        console.log('  Title Audio:', article.generatedTitleAudioUrl);
        if (article.generatedSummaryAudioUrl) {
          console.log('  Summary Audio:', article.generatedSummaryAudioUrl);
        }
        if (article.generatedContentAudioUrl) {
          console.log('  Content Audio:', article.generatedContentAudioUrl);
        }
        console.log('  Provider:', article.audioProvider);
        console.log('  Voice:', article.audioVoice);
      } else {
        console.log('\n⚠️  No TTS audio generated');
        if (article.audioError) {
          console.log('  Error:', article.audioError);
        }
      }
    }

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } else {
    console.error('\n❌ Scraping failed:', result.error);
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
