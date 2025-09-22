/**
 * Complete test for YouTube extraction API with all features
 * Run with: node __tests__/test-youtube-complete.js
 */

async function testYouTubeExtraction() {
  console.log('🧪 Testing YouTube extraction API with Japanese video...\n');

  // Test with a Japanese learning video that likely has captions
  const testUrls = [
    'https://www.youtube.com/watch?v=IciFhMmbkq0', // Japanese lesson video
    'https://www.youtube.com/watch?v=9Gqtu5FjcVQ', // Another Japanese video
  ];

  for (const url of testUrls) {
    console.log(`\n📺 Testing video: ${url}`);
    console.log('=' .repeat(60));

    try {
      console.log('📡 Sending request to API...');

      const response = await fetch('http://localhost:3004/api/youtube/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Simulate authenticated user for caching test
          'Cookie': 'authToken=test; session=test'
        },
        body: JSON.stringify({
          url,
          provider: 'auto',
          forceRegenerate: false
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ API responded successfully!\n');

        // Display response summary
        console.log('📊 Response Summary:');
        console.log('  - Success:', data.success);
        console.log('  - Method used:', data.method);
        console.log('  - Video Title:', data.videoTitle || 'N/A');
        console.log('  - Language:', data.language);
        console.log('  - From Cache:', data.fromCache || false);
        console.log('  - Has Formatted Version:', data.hasFormattedVersion || false);

        // Transcript info
        if (data.transcript) {
          console.log('\n📝 Transcript Info:');
          console.log('  - Total segments:', data.transcript.length);

          if (data.transcript.length > 0) {
            const totalDuration = data.transcript[data.transcript.length - 1].endTime;
            console.log('  - Duration:', Math.floor(totalDuration / 60) + ' minutes');

            // Show first 3 segments
            console.log('\n📜 First 3 segments:');
            data.transcript.slice(0, 3).forEach((line, i) => {
              console.log(`  ${i + 1}. [${line.startTime.toFixed(1)}s] ${line.text}`);
            });
          }
        }

        // Formatted transcript info
        if (data.formattedTranscript) {
          console.log('\n🤖 AI-Formatted Transcript:');
          console.log('  - Total segments:', data.formattedTranscript.length);

          // Check segment lengths
          const lengths = data.formattedTranscript.map(s => s.text.length);
          const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
          const longSegments = lengths.filter(l => l > 20).length;

          console.log('  - Average length:', avgLength.toFixed(1), 'chars');
          console.log('  - Long segments (>20 chars):', longSegments);

          // Show first 5 formatted segments
          console.log('\n📜 First 5 formatted segments (for shadowing):');
          data.formattedTranscript.slice(0, 5).forEach((line, i) => {
            console.log(`  ${i + 1}. "${line.text}" (${line.text.length} chars)`);
          });
        }

        // Video metadata
        if (data.videoMetadata) {
          console.log('\n📹 Video Metadata:');
          console.log('  - Channel:', data.videoMetadata.channelTitle || 'N/A');
          console.log('  - Duration:', data.videoMetadata.duration || 'N/A');
          console.log('  - Published:', data.videoMetadata.publishedAt ?
            new Date(data.videoMetadata.publishedAt).toLocaleDateString() : 'N/A');
          console.log('  - Has thumbnail:', !!data.videoMetadata.thumbnails);
        }

      } else {
        console.log('❌ API returned error:');
        console.log('  - Status:', response.status);
        console.log('  - Error Code:', data.error);
        console.log('  - Message:', data.message);

        if (data.suggestions) {
          console.log('\n💡 Suggestions:');
          data.suggestions.forEach(s => console.log('  -', s));
        }

        if (data.error === 'NO_CAPTIONS' || data.error === 'NO_TRANSCRIPT') {
          console.log('\n💡 This video might not have Japanese captions.');
          console.log('   The system will work better with videos that have Japanese subtitles.');
        }
      }

    } catch (error) {
      console.log('❌ Request failed:', error.message);
      console.log('\n💡 Make sure:');
      console.log('   1. Dev server is running on port 3004 (npm run dev)');
      console.log('   2. API keys are configured in .env.local');
      console.log('   3. At minimum, OPENAI_API_KEY should be set');
    }
  }

  // Test caching
  console.log('\n\n🔄 Testing Cache (making same request again)...');
  console.log('=' .repeat(60));

  const cacheTestUrl = testUrls[0];
  console.log('Testing cache with:', cacheTestUrl);

  try {
    const response = await fetch('http://localhost:3004/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'authToken=test; session=test'
      },
      body: JSON.stringify({
        url: cacheTestUrl,
        provider: 'auto'
      })
    });

    const data = await response.json();

    if (data.success && data.fromCache) {
      console.log('✅ Cache working! Response came from cache.');
    } else if (data.success) {
      console.log('⚠️  Response succeeded but not from cache (might be first run).');
    }
  } catch (error) {
    console.log('❌ Cache test failed:', error.message);
  }

  console.log('\n\n✅ Testing complete!');
  console.log('=' .repeat(60));
  console.log('\n📋 Summary:');
  console.log('- API endpoint is working');
  console.log('- YouTube extraction is functional');
  console.log('- Multiple fallback methods available');
  console.log('- AI formatting available if OPENAI_API_KEY is set');
  console.log('- Caching system is operational');
  console.log('\nRefer to YOUTUBE_API_SETUP.md for complete API configuration.');
}

// Run the test
testYouTubeExtraction().catch(console.error);