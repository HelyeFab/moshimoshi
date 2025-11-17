/**
 * Standalone verification script for Kokoro TTS audio generation
 */
import admin from 'firebase-admin';

// Initialize with environment credentials
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'moshimoshi-de237',
    clientEmail: 'firebase-adminsdk-fbsvc@moshimoshi-de237.iam.gserviceaccount.com',
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
  storageBucket: 'moshimoshi-de237.firebasestorage.app'
});

const db = admin.firestore();
const storage = admin.storage();

console.log('🔍 Verifying TTS Audio Generation Results\n');
console.log('=' .repeat(70));

try {
  // Get most recent articles
  const snapshot = await db.collection('news_articles')
    .where('source', '==', 'NHK Easy')
    .orderBy('publishDate', 'desc')
    .limit(5)
    .get();

  if (snapshot.empty) {
    console.log('❌ No articles found in Firestore\n');
    process.exit(1);
  }

  console.log(`\n✅ Found ${snapshot.size} recent articles\n`);

  let hasKokoro = 0;
  let hasEdgeTTS = 0;
  let noAudio = 0;
  let audioWithContent = 0;

  for (const [index, doc] of snapshot.docs.entries()) {
    const article = doc.data();

    console.log(`\n📰 Article ${index + 1}:`);
    console.log(`   Title: ${article.title?.substring(0, 60)}...`);
    console.log(`   Updated: ${article.lastUpdated?.toDate().toISOString()}`);
    console.log(`   Audio Status: ${article.audioStatus || 'N/A'}`);
    console.log(`   Audio Provider: ${article.audioProvider || 'N/A'}`);
    console.log(`   Audio Voice: ${article.audioVoice || 'N/A'}`);

    if (article.audioProvider === 'kokoro') {
      hasKokoro++;
      console.log(`   🎯 ✅ Using KOKORO TTS (SUCCESS!)`);
    } else if (article.audioProvider === 'edge-tts') {
      hasEdgeTTS++;
      console.log(`   ⚠️  Using Edge-TTS (old generation)`);
    } else {
      noAudio++;
      console.log(`   ❌ No audio provider`);
    }

    console.log(`   Audio Files:`);
    console.log(`      Title:   ${article.generatedTitleAudioUrl ? '✓' : '✗'}`);
    console.log(`      Summary: ${article.generatedSummaryAudioUrl ? '✓' : '✗'}`);
    console.log(`      Content: ${article.generatedContentAudioUrl ? '✓' : '✗'}`);

    if (article.generatedContentAudioUrl) {
      audioWithContent++;
    }

    if (article.audioError) {
      console.log(`   ⚠️  Error: ${article.audioError}`);
    }
  }

  // Check storage files
  console.log(`\n${'='.repeat(70)}`);
  console.log('\n📦 Checking Firebase Storage...\n');

  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({
    prefix: 'news-audio/nhk-easy/',
    maxResults: 20
  });

  if (files.length === 0) {
    console.log('❌ No audio files found in storage\n');
  } else {
    console.log(`✅ Found ${files.length} audio files in storage\n`);

    // Show recent files with non-zero size
    const validFiles = files.filter(f => parseInt(f.metadata.size) > 0);
    const emptyFiles = files.filter(f => parseInt(f.metadata.size) === 0);

    console.log(`   Valid files (size > 0): ${validFiles.length}`);
    console.log(`   Empty files (size = 0): ${emptyFiles.length}\n`);

    if (validFiles.length > 0) {
      console.log('   Recent valid files:');
      validFiles.slice(0, 5).forEach(file => {
        const sizeKB = (parseInt(file.metadata.size) / 1024).toFixed(2);
        console.log(`      ${file.name} - ${sizeKB} KB`);
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Total articles checked: ${snapshot.size}`);
  console.log(`   Using Kokoro TTS: ${hasKokoro} ${hasKokoro > 0 ? '✅' : '❌'}`);
  console.log(`   Using Edge-TTS: ${hasEdgeTTS}`);
  console.log(`   No audio: ${noAudio}`);
  console.log(`   With full content audio: ${audioWithContent}`);
  console.log(`   Audio files in storage: ${files.length}`);
  console.log(`   Valid audio files: ${files.filter(f => parseInt(f.metadata.size) > 0).length}`);

  if (hasKokoro > 0) {
    console.log(`\n🎉 SUCCESS! Kokoro TTS integration is working!\n`);
  } else {
    console.log(`\n⚠️  WARNING: No Kokoro-generated audio found yet.\n`);
    console.log(`   This means either:`);
    console.log(`   1. The scraper hasn't run with the new KOKORO_API_KEY yet`);
    console.log(`   2. There was an error during TTS generation\n`);
  }

  process.exit(0);

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
