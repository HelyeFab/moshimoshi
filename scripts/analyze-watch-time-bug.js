#!/usr/bin/env node

/**
 * Detailed analysis of watch time calculation
 * Investigating potential bugs in practice time tracking
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

async function analyzeWatchTime() {
  console.log('🔍 Watch Time Bug Analysis');
  console.log('═'.repeat(80));
  console.log(`User ID: ${USER_ID}\n`);

  try {
    // Get all practice history
    const practiceSnapshot = await db
      .collection('userPracticeHistory')
      .where('userId', '==', USER_ID)
      .where('contentType', '==', 'youtube')
      .get();

    console.log('📹 VIDEO-BY-VIDEO BREAKDOWN\n');

    let totalPracticeTime = 0;
    const videos = [];

    practiceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const videoId = data.videoId;
      const practiceTime = data.totalPracticeTime || 0;
      const practiceCount = data.practiceCount || 0;

      totalPracticeTime += practiceTime;

      // Calculate average time per practice session
      const avgPerSession = practiceCount > 0 ? practiceTime / practiceCount : 0;

      videos.push({
        videoId,
        practiceTime,
        practiceCount,
        avgPerSession,
        firstAccessed: data.firstAccessed?.toDate(),
        firstPracticed: data.firstPracticed?.toDate(),
        lastPracticed: data.lastPracticed?.toDate()
      });
    });

    // Sort by practice time (highest first)
    videos.sort((a, b) => b.practiceTime - a.practiceTime);

    videos.forEach((video, index) => {
      const hours = Math.floor(video.practiceTime / 3600);
      const minutes = Math.floor((video.practiceTime % 3600) / 60);
      const seconds = video.practiceTime % 60;

      console.log(`${index + 1}. ${video.videoId}`);
      console.log(`   Total Practice Time: ${video.practiceTime} seconds (${hours}h ${minutes}m ${seconds}s)`);
      console.log(`   Practice Count: ${video.practiceCount} sessions`);
      console.log(`   Avg per session: ${Math.round(video.avgPerSession)} seconds (${Math.round(video.avgPerSession / 60)} min)`);

      // Calculate time span if we have dates
      if (video.firstPracticed && video.lastPracticed) {
        const timeSpan = video.lastPracticed - video.firstPracticed;
        const spanHours = Math.floor(timeSpan / (1000 * 60 * 60));
        const spanMinutes = Math.floor((timeSpan % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`   Time span: ${spanHours}h ${spanMinutes}m (from first to last practice)`);

        // Check if practice time exceeds time span (impossible!)
        if (video.practiceTime * 1000 > timeSpan) {
          console.log(`   🚨 BUG DETECTED: Practice time (${video.practiceTime}s) > actual time span (${Math.round(timeSpan/1000)}s)`);
          console.log(`      This is IMPOSSIBLE - you can't practice more than elapsed time!`);
        }
      }

      // Flag suspicious patterns
      if (video.avgPerSession > 600) {
        console.log(`   ⚠️  WARNING: Average session > 10 minutes (${Math.round(video.avgPerSession/60)} min)`);
      }
      if (video.practiceCount > 100) {
        console.log(`   ⚠️  WARNING: Very high practice count (${video.practiceCount} sessions)`);
      }

      console.log('');
    });

    // Overall analysis
    console.log('═'.repeat(80));
    console.log('📊 OVERALL ANALYSIS\n');

    const totalHours = Math.floor(totalPracticeTime / 3600);
    const totalMinutes = Math.floor((totalPracticeTime % 3600) / 60);

    console.log(`Total Practice Time: ${totalPracticeTime} seconds`);
    console.log(`                   = ${totalHours}h ${totalMinutes}m`);
    console.log(`                   = ${Math.round(totalPracticeTime / 60)} minutes`);
    console.log(`Total Videos: ${videos.length}`);
    console.log(`Total Practice Sessions: ${videos.reduce((sum, v) => sum + v.practiceCount, 0)}`);
    console.log('');

    // Check if total makes sense
    const oldestPractice = videos.reduce((oldest, v) => {
      if (!v.firstPracticed) return oldest;
      if (!oldest) return v.firstPracticed;
      return v.firstPracticed < oldest ? v.firstPracticed : oldest;
    }, null);

    const newestPractice = videos.reduce((newest, v) => {
      if (!v.lastPracticed) return newest;
      if (!newest) return v.lastPracticed;
      return v.lastPracticed > newest ? v.lastPracticed : newest;
    }, null);

    if (oldestPractice && newestPractice) {
      const totalTimeSpan = newestPractice - oldestPractice;
      const spanHours = Math.floor(totalTimeSpan / (1000 * 60 * 60));
      const spanMinutes = Math.floor((totalTimeSpan % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`📅 Time Period:`);
      console.log(`   First practice: ${oldestPractice}`);
      console.log(`   Last practice: ${newestPractice}`);
      console.log(`   Total span: ${spanHours}h ${spanMinutes}m`);
      console.log('');

      // Check if total practice time exceeds time span
      if (totalPracticeTime * 1000 > totalTimeSpan) {
        console.log(`🚨 CRITICAL BUG DETECTED!`);
        console.log(`   Total practice time (${totalHours}h ${totalMinutes}m) exceeds actual time span (${spanHours}h ${spanMinutes}m)`);
        console.log(`   This is PHYSICALLY IMPOSSIBLE!`);
        console.log('');
        console.log(`💡 Likely cause:`);
        console.log(`   - Practice time is being counted multiple times`);
        console.log(`   - /api/practice/track is ADDING time instead of tracking actual duration`);
        console.log(`   - Bug in how practiceTime is calculated/stored`);
      }
    }

    console.log('');
    console.log('═'.repeat(80));

    // Now check the actual API tracking logic
    console.log('🔬 CHECKING API TRACKING BEHAVIOR\n');

    console.log('Expected behavior:');
    console.log('  ✅ /api/practice/track should receive practiceTime from client');
    console.log('  ✅ practiceTime should be ACTUAL seconds watched (not cumulative)');
    console.log('  ✅ Server should ADD this to totalPracticeTime');
    console.log('');

    console.log('Potential bugs:');
    console.log('  ❌ Client sending cumulative time instead of session duration');
    console.log('  ❌ Server counting time multiple times per video load');
    console.log('  ❌ Timer bug causing inflated duration values');
    console.log('');

    // Check userYouTubeHistory for comparison
    console.log('═'.repeat(80));
    console.log('🔍 COMPARING WITH userYouTubeHistory (Premium)\n');

    const youtubeHistorySnapshot = await db
      .collection('userYouTubeHistory')
      .where('userId', '==', USER_ID)
      .get();

    console.log('Comparing totalWatchTime between collections:\n');

    youtubeHistorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const videoId = data.videoId;
      const watchTime = data.totalWatchTime || 0;
      const watchCount = data.watchCount || 0;

      // Find matching practice history
      const practiceVideo = videos.find(v => v.videoId === `youtube_${videoId}`);

      if (practiceVideo) {
        const diff = Math.abs(watchTime - practiceVideo.practiceTime);
        console.log(`${videoId}:`);
        console.log(`  userYouTubeHistory.totalWatchTime: ${watchTime}s`);
        console.log(`  userPracticeHistory.totalPracticeTime: ${practiceVideo.practiceTime}s`);
        console.log(`  Difference: ${diff}s`);

        if (diff > 60) {
          console.log(`  ⚠️  MISMATCH > 1 minute!`);
        }
        console.log('');
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeWatchTime();
