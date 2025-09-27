const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function testAITranscript() {
  try {
    console.log('🔍 Testing AI Transcript Processing and Caching\n');
    console.log('='.repeat(60));

    // Check if OpenAI API key is configured
    const hasOpenAIKey = !!process.env.OPEN_AI_API_KEY || !!process.env.OPENAI_API_KEY;
    console.log('\n🔑 OpenAI API Key Status:');
    console.log(`  OPEN_AI_API_KEY: ${process.env.OPEN_AI_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set'}`);
    console.log(`  Overall: ${hasOpenAIKey ? '✅ API key available' : '❌ No API key found'}`);

    if (!hasOpenAIKey) {
      console.log('\n⚠️  WARNING: No OpenAI API key found!');
      console.log('  AI processing will fail and transcripts won\'t be cached.');
      console.log('  Make sure OPEN_AI_API_KEY is set in .env.local');
    }

    // Test video ID (use a real video with captions)
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up (has captions)
    const contentId = `youtube_${testVideoId}`;

    console.log('\n📺 Test Video:');
    console.log(`  Video ID: ${testVideoId}`);
    console.log(`  Content ID: ${contentId}`);
    console.log(`  URL: https://www.youtube.com/watch?v=${testVideoId}`);

    // Check if transcript is already cached
    console.log('\n📂 Checking transcriptCache collection...');
    const cacheDoc = await db.collection('transcriptCache').doc(contentId).get();

    if (cacheDoc.exists) {
      const data = cacheDoc.data();
      console.log('✅ Transcript found in cache!');
      console.log('  - Content Type:', data.contentType);
      console.log('  - Language:', data.language);
      console.log('  - Video Title:', data.videoTitle);
      console.log('  - Has Raw Transcript:', !!data.transcript);
      console.log('  - Raw Transcript Lines:', data.transcript ? data.transcript.length : 0);
      console.log('  - Has AI Formatted:', !!data.formattedTranscript);
      console.log('  - AI Formatted Lines:', data.formattedTranscript ? data.formattedTranscript.length : 0);
      console.log('  - Created At:', data.createdAt ? new Date(data.createdAt._seconds * 1000) : 'N/A');
      console.log('  - Access Count:', data.accessCount || 0);

      if (data.metadata) {
        console.log('  - Metadata:');
        console.log('    • Was Formatted:', data.metadata.wasFormatted || false);
        console.log('    • Formatting Model:', data.metadata.formattingModel || 'N/A');
        if (data.metadata.formattedAt) {
          console.log('    • Formatted At:', new Date(data.metadata.formattedAt._seconds * 1000));
        }
      }

      if (data.formattedTranscript && data.formattedTranscript.length > 0) {
        console.log('\n  📝 First AI-formatted line sample:');
        const firstLine = data.formattedTranscript[0];
        console.log('    Text:', firstLine.text);
        console.log('    Start:', firstLine.startTime, 'sec');
        console.log('    End:', firstLine.endTime, 'sec');
      }
    } else {
      console.log('❌ No transcript found in cache');
      console.log('\nTo test AI transcript caching:');
      console.log('1. Ensure OPEN_AI_API_KEY is set in .env.local');
      console.log('2. Restart the dev server to load the env variable');
      console.log('3. Go to http://localhost:3001/youtube-shadowing');
      console.log(`4. Enter: https://www.youtube.com/watch?v=${testVideoId}`);
      console.log('5. Click "Load Video"');
      console.log('6. Wait for AI processing to complete');
      console.log('7. Run this script again to verify caching worked');
    }

    console.log('\n' + '-'.repeat(60));

    // Check all cached transcripts
    console.log('\n📊 All Cached Transcripts Summary:');
    const allCache = await db.collection('transcriptCache').get();

    if (allCache.empty) {
      console.log('  No transcripts cached yet');
    } else {
      console.log(`  Found ${allCache.size} cached transcript(s):\n`);

      let withAI = 0;
      let withoutAI = 0;

      allCache.forEach(doc => {
        const data = doc.data();
        const hasAI = !!data.formattedTranscript;

        if (hasAI) withAI++;
        else withoutAI++;

        console.log(`  • ${doc.id}`);
        console.log(`    - Type: ${data.contentType}`);
        console.log(`    - Title: ${data.videoTitle || 'Untitled'}`);
        console.log(`    - Language: ${data.language}`);
        console.log(`    - Raw Lines: ${data.transcript ? data.transcript.length : 0}`);
        console.log(`    - AI Formatted: ${hasAI ? '✅' : '❌'}`);
        if (hasAI) {
          console.log(`    - AI Lines: ${data.formattedTranscript.length}`);
        }
        console.log(`    - Access Count: ${data.accessCount || 0}`);
        console.log('');
      });

      console.log(`  Summary: ${withAI} with AI formatting, ${withoutAI} without`);
    }

    console.log('\n✅ Test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testAITranscript();