const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testTranscriptCache() {
  try {
    console.log('🔍 Testing Transcript Cache System\n');
    console.log('='.repeat(60));

    // Test with a real popular Japanese YouTube video
    // Using "【初音ミク】千本桜" - a very popular Vocaloid song
    const testVideoId = 'shs0KM8bNRU';
    const testVideoUrl = `https://www.youtube.com/watch?v=${testVideoId}`;
    const contentId = `youtube_${testVideoId}`;

    console.log('\n📺 Test Video Details:');
    console.log('  Video ID:', testVideoId);
    console.log('  Video URL:', testVideoUrl);
    console.log('  Content ID:', contentId);
    console.log('  Title: 千本桜 (Senbonzakura) - Popular Japanese Song\n');

    // Check transcriptCache collection
    console.log('📂 Checking transcriptCache collection...');
    const cacheDoc = await db.collection('transcriptCache').doc(contentId).get();

    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      console.log('✅ Transcript found in cache!');
      console.log('  - Content Type:', data.contentType);
      console.log('  - Language:', data.language);
      console.log('  - Video Title:', data.videoTitle);
      console.log('  - Has Transcript:', !!data.transcript);
      console.log('  - Transcript Lines:', data.transcript ? data.transcript.length : 0);
      console.log('  - Has Formatted:', !!data.formattedTranscript);
      console.log('  - Formatted Lines:', data.formattedTranscript ? data.formattedTranscript.length : 0);
      console.log('  - Created At:', data.createdAt ? data.createdAt.toDate() : 'N/A');
      console.log('  - Access Count:', data.accessCount || 0);

      if (data.metadata) {
        console.log('  - Metadata:');
        console.log('    • Channel:', data.metadata.channelName || 'N/A');
        console.log('    • Thumbnail:', data.metadata.thumbnailUrl ? 'Yes' : 'No');
        console.log('    • Was Formatted:', data.metadata.wasFormatted || false);
      }

      if (data.transcript && data.transcript.length > 0) {
        console.log('\n  📝 First transcript line sample:');
        const firstLine = data.transcript[0];
        console.log('    Text:', firstLine.text);
        console.log('    Start:', firstLine.startTime, 'sec');
        console.log('    End:', firstLine.endTime, 'sec');
      }
    } else {
      console.log('❌ No transcript found in cache for this video');
      console.log('   To test caching, please:');
      console.log('   1. Go to http://localhost:3001/youtube-shadowing');
      console.log(`   2. Enter this URL: ${testVideoUrl}`);
      console.log('   3. Click "Load Video"');
      console.log('   4. Wait for AI processing to complete');
      console.log('   5. Run this script again to verify caching worked');
    }

    console.log('\n' + '-'.repeat(60));

    // Check all transcriptCache documents
    console.log('\n📊 All Cached Transcripts Summary:');
    const allCache = await db.collection('transcriptCache').get();

    if (allCache.empty) {
      console.log('  No transcripts cached yet');
    } else {
      console.log(`  Found ${allCache.size} cached transcript(s):\n`);
      allCache.forEach(doc => {
        const data = doc.data();
        console.log(`  • ${doc.id}`);
        console.log(`    - Type: ${data.contentType}`);
        console.log(`    - Title: ${data.videoTitle || 'Untitled'}`);
        console.log(`    - Language: ${data.language}`);
        console.log(`    - Lines: ${data.transcript ? data.transcript.length : 0}`);
        console.log(`    - AI Formatted: ${!!data.formattedTranscript}`);
        console.log(`    - Access Count: ${data.accessCount || 0}`);
        console.log('');
      });
    }

    console.log('='.repeat(60));

    // Test userYouTubeHistory for premium users
    console.log('\n📺 Checking userYouTubeHistory for recent videos...');
    const recentHistory = await db.collection('userYouTubeHistory')
      .orderBy('lastWatched', 'desc')
      .limit(5)
      .get();

    if (!recentHistory.empty) {
      console.log(`Found ${recentHistory.size} recent video(s):`);
      recentHistory.forEach(doc => {
        const data = doc.data();
        console.log(`  • ${data.videoTitle || 'Untitled'}`);
        console.log(`    - Video ID: ${data.videoId}`);
        console.log(`    - User: ${data.userId}`);
        console.log(`    - Has Transcript: ${!!data.transcript}`);
        console.log(`    - Last Watched: ${data.lastWatched ? data.lastWatched.toDate() : 'N/A'}`);
      });
    } else {
      console.log('  No video history found');
    }

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testTranscriptCache();