/**
 * Test script for YouTube extraction API
 * Run with: node __tests__/test-youtube-api.js
 */

async function testYouTubeExtraction() {
  console.log('🧪 Testing YouTube extraction API...\n');

  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up

  try {
    console.log('📡 Sending request to API...');
    const response = await fetch('http://localhost:3003/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ API responded successfully!\n');
      console.log('📊 Response summary:');
      console.log('  - Success:', data.success);
      console.log('  - Video Title:', data.videoTitle || 'N/A');
      console.log('  - Language:', data.language);
      console.log('  - Transcript Lines:', data.transcript?.length || 0);
      console.log('  - From Cache:', data.fromCache || false);
      console.log('  - Has Formatted Version:', data.hasFormattedVersion || false);

      if (data.transcript?.length > 0) {
        console.log('\n📝 First 3 transcript lines:');
        data.transcript.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}. [${line.startTime}s] ${line.text}`);
        });
      }

      if (data.videoMetadata) {
        console.log('\n📹 Video metadata:');
        console.log('  - Channel:', data.videoMetadata.channelTitle);
        console.log('  - Duration:', data.videoMetadata.duration);
        console.log('  - Published:', data.videoMetadata.publishedAt);
      }
    } else {
      console.log('❌ API returned error:');
      console.log('  - Status:', response.status);
      console.log('  - Error Code:', data.error);
      console.log('  - Message:', data.message);

      if (data.error === 'NO_TRANSCRIPT') {
        console.log('\n💡 This video might not have captions available.');
        console.log('   Try a video with Japanese captions for better results.');
      }
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
    console.log('\n💡 Make sure the dev server is running on port 3003');
    console.log('   Run: npm run dev');
  }
}

// Run the test
testYouTubeExtraction().catch(console.error);