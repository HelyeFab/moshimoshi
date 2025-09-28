const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkVideoProcessing(videoId) {
  try {
    console.log(`\n🔍 Checking processing status for video: ${videoId}\n`);
    console.log('Video URL: https://youtu.be/' + videoId);

    // Simple check - just look for the content ID
    const contentId = `youtube_${videoId}`;
    console.log('Looking for content ID:', contentId);

    // Check transcript cache by document ID
    const cacheDoc = await db.collection('transcriptCache').doc(contentId).get();

    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      console.log('\n📦 Found in transcript cache!');
      console.log('================================');
      console.log('- Video Title:', data.videoTitle);
      console.log('- Language:', data.language);
      console.log('- Created At:', data.createdAt?.toDate());
      console.log('- Transcript Lines:', data.transcript?.length || 0);
      console.log('- Has AI Formatted Version:', !!data.formattedTranscript);
      console.log('- Formatted Lines:', data.formattedTranscript?.length || 0);

      if (data.metadata) {
        console.log('\n📋 Metadata:');
        console.log('- Was AI Formatted:', data.metadata.wasFormatted || false);
        console.log('- AI Model Used:', data.metadata.formattingModel || 'N/A');
        console.log('- Channel:', data.metadata.channelName);
        console.log('- Duration:', data.metadata.duration);
        console.log('- Processing Method:', data.metadata.method);
      }

      if (data.formattedTranscript && data.formattedTranscript.length > 0) {
        console.log('\n✅ ✅ ✅ Video HAS been AI processed! ✅ ✅ ✅');
        console.log('\nSample of AI-formatted transcript (first 3 lines):');
        console.log('================================================');
        data.formattedTranscript.slice(0, 3).forEach((line, idx) => {
          console.log(`\nLine ${idx + 1}:`);
          console.log(`  Text: "${line.text}"`);
          console.log(`  Time: ${line.startTime}s - ${line.endTime}s`);
        });
      } else {
        console.log('\n❌ ❌ ❌ Video has NOT been AI processed yet ❌ ❌ ❌');

        if (data.transcript && data.transcript.length > 0) {
          console.log('\n📝 Original transcript exists with', data.transcript.length, 'lines');
          console.log('Sample of original transcript (first 2 lines):');
          console.log('================================================');
          data.transcript.slice(0, 2).forEach((line, idx) => {
            console.log(`\nLine ${idx + 1}:`);
            console.log(`  Text: "${line.text}"`);
            console.log(`  Time: ${line.startTime}s - ${line.endTime}s`);
          });
        }
      }
    } else {
      console.log('❌ Video not found in transcript cache');
      console.log('\nThis video has not been loaded yet.');
      console.log('To process it:');
      console.log('1. Go to the YouTube shadowing page');
      console.log('2. Enter this URL: https://youtu.be/' + videoId);
      console.log('3. Click "Load Video"');
    }

    // Also check user YouTube history
    console.log('\n🎬 Checking user YouTube history...');
    const historyQuery = await db.collection('userYouTubeHistory')
      .where('videoId', '==', videoId)
      .limit(3)
      .get();

    if (!historyQuery.empty) {
      console.log(`Found ${historyQuery.size} user(s) who loaded this video`);
    }

  } catch (error) {
    console.error('\n❌ Error checking video processing:', error.message);
  }

  process.exit();
}

const videoId = process.argv[2] || '64yPcVnNjYk';
checkVideoProcessing(videoId);