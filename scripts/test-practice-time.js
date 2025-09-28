#!/usr/bin/env node

/**
 * Test script to verify practice time tracking
 * Simulates a YouTube shadowing session and checks if practice time is recorded
 */

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dD2EISUDjVE';
const TEST_VIDEO_ID = 'dD2EISUDjVE';
const TEST_VIDEO_TITLE = 'Test Video for Practice Time';

async function simulatePracticeSession() {
  console.log('🧪 Testing Practice Time Tracking...\n');

  // Simulate a practice session with 10 seconds of practice time
  const practiceTimeInSeconds = 10;

  const requestBody = {
    videoUrl: TEST_VIDEO_URL,
    videoTitle: TEST_VIDEO_TITLE,
    videoId: TEST_VIDEO_ID,
    thumbnailUrl: 'https://i.ytimg.com/vi/dD2EISUDjVE/maxresdefault.jpg',
    channelName: 'Test Channel',
    duration: 180, // 3 minutes
    practiceTime: practiceTimeInSeconds,
    metadata: {
      title: TEST_VIDEO_TITLE,
      channelTitle: 'Test Channel',
      duration: 'PT3M'
    }
  };

  console.log('📤 Sending practice session data:');
  console.log(`   Video: ${TEST_VIDEO_TITLE}`);
  console.log(`   Practice Time: ${practiceTimeInSeconds} seconds`);
  console.log('');

  try {
    // Send to API
    const response = await fetch('http://localhost:3001/api/practice/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No auth headers - testing as anonymous user
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Practice session tracked successfully!');
      console.log('   Response:', result);
    } else {
      console.log('❌ Error tracking practice session:');
      console.log('   Status:', response.status);
      console.log('   Error:', result.error);
    }

    // Now fetch the practice history to verify
    console.log('\n📥 Fetching practice history...');
    const historyResponse = await fetch('http://localhost:3001/api/practice/track', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const historyResult = await historyResponse.json();

    if (historyResponse.ok) {
      console.log('✅ Practice history retrieved:');
      console.log(`   Total Videos: ${historyResult.count || 0}`);
      console.log(`   Total Practice Time: ${historyResult.stats?.totalPracticeTime || 0} seconds`);
      console.log(`   Total Practice Count: ${historyResult.stats?.totalPracticeCount || 0}`);

      // Check if our test video is in the history
      const testVideo = historyResult.items?.find(v => v.videoId === TEST_VIDEO_ID);
      if (testVideo) {
        console.log('\n🎯 Found test video in history:');
        console.log(`   Practice Time: ${testVideo.totalPracticeTime || 0} seconds`);
        console.log(`   Practice Count: ${testVideo.practiceCount || 0}`);
      } else {
        console.log('\n⚠️  Test video not found in history (may be using localStorage for anonymous users)');
      }
    } else {
      console.log('❌ Error fetching practice history:');
      console.log('   Status:', historyResponse.status);
      console.log('   Error:', historyResult.error);
    }

  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('\n💡 Make sure the dev server is running on port 3001');
  }
}

// Run the test
simulatePracticeSession();