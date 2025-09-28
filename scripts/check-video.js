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

    // Check transcript cache
    const cacheQuery = await db.collection('transcriptCache')
      .where('metadata.youtubeVideoId', '==', videoId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!cacheQuery.empty) {
      const cacheDoc = cacheQuery.docs[0];
      const data = cacheDoc.data();
      console.log('📦 Found in transcript cache:');
      console.log('- Document ID:', cacheDoc.id);
      console.log('- Content ID:', data.contentId);
      console.log('- Video Title:', data.videoTitle);
      console.log('- Language:', data.language);
      console.log('- Has Formatted Transcript:', !!data.formattedTranscript);
      console.log('- Was AI Processed:', data.metadata?.wasFormatted || false);
      console.log('- AI Model Used:', data.metadata?.formattingModel || 'N/A');
      console.log('- Created At:', data.createdAt?.toDate());
      console.log('- Transcript Lines:', data.transcript?.length || 0);
      console.log('- Formatted Lines:', data.formattedTranscript?.length || 0);

      if (data.formattedTranscript && data.formattedTranscript.length > 0) {
        console.log('\n✅ Video HAS been AI processed!');
        console.log('\nSample of AI-formatted transcript (first 3 lines):');
        data.formattedTranscript.slice(0, 3).forEach((line, idx) => {
          console.log(`\n  Line ${idx + 1}:`);
          console.log(`    Text: "${line.text}"`);
          console.log(`    Start: ${line.startTime}s, End: ${line.endTime}s`);
        });
      } else {
        console.log('\n❌ Video has NOT been AI processed yet.');
        if (data.transcript && data.transcript.length > 0) {
          console.log('\nOriginal transcript exists with', data.transcript.length, 'lines');
          console.log('Sample of original transcript (first line):');
          console.log(`  Text: "${data.transcript[0].text}"`);
        }
      }

      // Show metadata
      if (data.metadata) {
        console.log('\n📋 Additional Metadata:');
        console.log('- Channel:', data.metadata.channelName);
        console.log('- Duration:', data.metadata.duration);
        console.log('- Method:', data.metadata.method);
      }
    } else {
      console.log('❌ Video not found in transcript cache');
      console.log('\nThis video has not been processed yet.');
      console.log('To process it, load it in the YouTube shadowing page.');
    }

    // Check API usage logs
    const apiLogsQuery = await db.collection('apiUsageLogs')
      .where('metadata.videoId', '==', videoId)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();

    if (!apiLogsQuery.empty) {
      console.log('\n📊 Recent API usage for this video:');
      apiLogsQuery.docs.forEach(doc => {
        const log = doc.data();
        const timestamp = log.timestamp?.toDate();
        console.log(`- ${log.api}: ${log.success ? '✅ Success' : '❌ Failed'} at ${timestamp}`);
        if (!log.success && log.error) {
          console.log(`  Error: ${log.error}`);
        }
      });
    }

  } catch (error) {
    console.error('Error checking video processing:', error);
  }

  process.exit();
}

const videoId = '64yPcVnNjYk';
console.log('Video ID:', videoId);
console.log('Video URL: https://youtu.be/' + videoId);
checkVideoProcessing(videoId);