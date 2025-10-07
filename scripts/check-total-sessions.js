#!/usr/bin/env node

/**
 * Check how total sessions are calculated on /my-videos page
 */

const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const USER_ID = '8onZzlQg3tQxkw8pinSF9ow4Q6j2';

async function checkTotalSessions() {
  console.log('🔍 Total Sessions Calculation Check');
  console.log('═'.repeat(80));
  console.log(`User ID: ${USER_ID}\n`);

  try {
    // Get all practice history
    const practiceSnapshot = await db
      .collection('userPracticeHistory')
      .where('userId', '==', USER_ID)
      .where('contentType', '==', 'youtube')
      .get();

    console.log('📊 HOW /MY-VIDEOS CALCULATES TOTAL SESSIONS\n');
    console.log('From MyVideos.tsx line 384:');
    console.log('  videos.reduce((sum, v) => sum + (v.practiceCount || 0), 0)\n');
    console.log('This sums up the practiceCount field from all videos.\n');

    console.log('─'.repeat(80));
    console.log('VIDEO BREAKDOWN:\n');

    let totalSessions = 0;
    const videos = [];

    practiceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const videoId = data.videoId;
      const practiceCount = data.practiceCount || 0;

      totalSessions += practiceCount;

      videos.push({
        videoId,
        practiceCount,
        totalPracticeTime: data.totalPracticeTime || 0,
        firstPracticed: data.firstPracticed?.toDate(),
        lastPracticed: data.lastPracticed?.toDate()
      });
    });

    // Sort by practice count
    videos.sort((a, b) => b.practiceCount - a.practiceCount);

    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.videoId}`);
      console.log(`   Practice Sessions: ${video.practiceCount}`);
      console.log(`   Total Practice Time: ${video.totalPracticeTime}s (${Math.round(video.totalPracticeTime / 60)}m)`);

      if (video.practiceCount > 0) {
        const avgTimePerSession = video.totalPracticeTime / video.practiceCount;
        console.log(`   Avg per session: ${Math.round(avgTimePerSession)}s (${Math.round(avgTimePerSession / 60)}m)`);
      }
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log('TOTAL SESSIONS CALCULATION:\n');
    console.log(`Sum of all practiceCount fields: ${totalSessions} sessions`);
    console.log('');

    // Check if this makes sense
    console.log('─'.repeat(80));
    console.log('VALIDATION:\n');

    console.log('❓ Is this number realistic?');
    console.log('   Let\'s check the most practiced video:\n');

    const mostPracticed = videos[0];
    if (mostPracticed && mostPracticed.firstPracticed && mostPracticed.lastPracticed) {
      const timeSpan = mostPracticed.lastPracticed - mostPracticed.firstPracticed;
      const spanMinutes = Math.floor(timeSpan / (1000 * 60));
      const avgSessionDuration = mostPracticed.totalPracticeTime / mostPracticed.practiceCount;
      const avgSessionDurationMinutes = Math.round(avgSessionDuration / 60);

      console.log(`   ${mostPracticed.videoId}:`);
      console.log(`   - ${mostPracticed.practiceCount} sessions in ${spanMinutes} minutes`);
      console.log(`   - Average session: ${avgSessionDurationMinutes} minutes`);
      console.log(`   - That's a session every ${Math.round(spanMinutes / mostPracticed.practiceCount)} minutes\n`);

      if (mostPracticed.practiceCount > 100) {
        console.log(`   ⚠️  ${mostPracticed.practiceCount} sessions seems very high!`);
        console.log(`   → This could indicate the bug where practice time tracking`);
        console.log(`      was called too frequently.\n`);
      }
    }

    // Explain what practiceCount tracks
    console.log('─'.repeat(80));
    console.log('📚 WHAT IS practiceCount?\n');
    console.log('From /api/practice/track route.ts line 102:');
    console.log('  practiceCount: (existingStats?.practiceCount || 0) + 1\n');
    console.log('This increments every time the practice tracking API is called.');
    console.log('The API is called:');
    console.log('  1. When user practices for 30+ seconds');
    console.log('  2. Auto-saves during practice session');
    console.log('  3. Final save when leaving the page\n');

    console.log('⚠️  IMPORTANT: practiceCount does NOT mean "number of times');
    console.log('   video was loaded" - it means "number of tracking API calls".\n');

    console.log('With auto-save every 30 seconds, a 10-minute practice session');
    console.log('could result in 20+ practiceCount increments!\n');

    console.log('═'.repeat(80));
    console.log('💡 RECOMMENDATION:\n');
    console.log('The "Total Sessions" stat is misleading because:');
    console.log('  1. It counts auto-save calls, not actual practice sessions');
    console.log('  2. A single video watch generates many "sessions"\n');

    console.log('Better metrics would be:');
    console.log('  - Total Videos Practiced (unique videos)');
    console.log('  - Total Practice Time (already shown)');
    console.log('  - Average time per video\n');

    console.log('Or rename "Total Sessions" to something like:');
    console.log('  - "Practice Activity" or "Practice Interactions"\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkTotalSessions();
