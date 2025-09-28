import { adminFirestore as db } from '../src/lib/firebase/admin';

async function checkVideoProcessing(videoId: string) {
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
        console.log('\n✅ Video has been AI processed!');
        console.log('\nSample of formatted transcript (first 3 lines):');
        data.formattedTranscript.slice(0, 3).forEach((line: any, idx: number) => {
          console.log(`\n  Line ${idx + 1}:`);
          console.log(`    Text: "${line.text}"`);
          console.log(`    Start: ${line.startTime}s, End: ${line.endTime}s`);
        });
      } else {
        console.log('\n❌ Video has NOT been AI processed yet.');
        if (data.transcript && data.transcript.length > 0) {
          console.log('\nOriginal transcript exists with', data.transcript.length, 'lines');
          console.log('Sample (first line):');
          console.log(`  Text: "${data.transcript[0].text}"`);
        }
      }
    } else {
      console.log('❌ Video not found in transcript cache');
    }

    // Check API usage logs for this video
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
        console.log(`- ${log.api}: ${log.success ? '✅' : '❌'} at ${timestamp}`);
        if (!log.success && log.error) {
          console.log(`  Error: ${log.error}`);
        }
      });
    }

    // Check user YouTube history
    console.log('\n🎬 Checking user YouTube history...');
    const historyQuery = await db.collection('userYouTubeHistory')
      .where('videoId', '==', videoId)
      .limit(5)
      .get();

    if (!historyQuery.empty) {
      console.log(`Found ${historyQuery.size} user(s) who watched this video`);
      historyQuery.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- User: ${data.userId?.substring(0, 8)}...`);
        console.log(`  Watch count: ${data.watchCount || 1}`);
        console.log(`  Last watched: ${data.lastWatched?.toDate()}`);
      });
    }

  } catch (error) {
    console.error('Error checking video processing:', error);
  } finally {
    process.exit();
  }
}

// Get video ID from command line argument
const videoId = process.argv[2];
if (!videoId) {
  console.log('Usage: npx tsx scripts/check-video-processing.ts <videoId>');
  console.log('Example: npx tsx scripts/check-video-processing.ts dQw4w9WgXcQ');
  process.exit(1);
}

checkVideoProcessing(videoId);