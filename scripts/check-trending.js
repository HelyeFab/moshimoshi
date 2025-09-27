const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkTrendingVideos() {
  console.log('🔍 Checking Why Video Is Not In Trending\n');
  console.log('='.repeat(60));

  // Check userYouTubeHistory collection
  console.log('\n📺 userYouTubeHistory Collection (used for trending):');
  const history = await db.collection('userYouTubeHistory')
    .orderBy('lastWatched', 'desc')
    .limit(10)
    .get();

  console.log('Total videos in history:', history.size);

  if (!history.empty) {
    console.log('\nVideos in history:');
    history.forEach(doc => {
      const data = doc.data();
      console.log(`  • ${data.videoTitle || data.videoId}`);
      console.log(`    User: ${data.userId}`);
      console.log(`    Watch count: ${data.watchCount || 1}`);
      console.log(`    Last watched: ${data.lastWatched?.toDate?.()}`);
    });
  } else {
    console.log('  ❌ No videos in userYouTubeHistory!');
    console.log('     This is why trending is empty.');
  }

  // Check transcriptCache
  console.log('\n\n📝 transcriptCache Collection (only stores transcripts):');
  const cache = await db.collection('transcriptCache').get();
  console.log('Total cached transcripts:', cache.size);

  if (!cache.empty) {
    console.log('\nCached transcripts:');
    cache.forEach(doc => {
      const data = doc.data();
      console.log(`  • ${doc.id}`);
      console.log(`    Title: ${data.videoTitle?.substring(0, 60)}`);
      console.log(`    Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
    });
  }

  // Explain the issue
  console.log('\n\n❗ ISSUE IDENTIFIED:');
  console.log('='.repeat(60));

  if (history.empty && !cache.empty) {
    console.log('✅ Transcripts are being cached (transcriptCache collection)');
    console.log('❌ Videos are NOT being saved to userYouTubeHistory');
    console.log('\nThe trending section pulls from userYouTubeHistory, not transcriptCache.');
    console.log('The YouTube extraction API is caching transcripts but not creating history records.');
    console.log('\nThis needs to be fixed in the /api/youtube/extract route to also save to userYouTubeHistory.');
  } else if (history.empty && cache.empty) {
    console.log('❌ No data in either collection');
    console.log('Videos are not being processed at all.');
  } else {
    console.log('✅ Both collections have data');
    console.log('The system appears to be working correctly.');
  }

  process.exit(0);
}

checkTrendingVideos().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});