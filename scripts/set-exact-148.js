const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setExact148() {
  try {
    console.log('🎯 Setting EXACT 148x watches...\n');

    const videoId = 'ofkWnxFRclY';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch video metadata
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`
    );
    const data = await response.json();
    const video = data.items[0];
    const videoTitle = video.snippet.title;
    const channelName = video.snippet.channelTitle;
    const thumbnailUrl = video.snippet.thumbnails?.maxres?.url ||
                        video.snippet.thumbnails?.high?.url;

    const userIds = [
      'trending_user_1',
      'trending_user_2',
      'trending_user_3',
      'trending_user_4',
      'trending_user_5',
      'trending_user_6',
      'trending_user_7',
      'trending_user_8',
      'trending_user_9',
      'trending_user_10',
      'trending_user_11',
      'trending_user_12',
      'trending_user_13',
      'trending_user_14',
      'trending_user_15'
    ];

    // Distribute exactly 148 watches: 13 users with 10, 2 users with 9 = 130 + 18 = 148
    const watchCounts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9]; // = 148

    let totalWatches = 0;

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const docId = `${userId}_${videoId}`;
      const watchCount = watchCounts[i];
      const totalWatchTime = 5760; // Exactly 96 minutes

      await db.collection('userYouTubeHistory').doc(docId).set({
        userId,
        videoId,
        videoUrl,
        videoTitle,
        channelName,
        thumbnailUrl,
        watchCount,
        totalWatchTime,
        lastWatched: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now()
      });

      totalWatches += watchCount;
    }

    const score = 15 * 2 + totalWatches;

    console.log(`✅ Exact stats set!`);
    console.log(`  - Unique viewers: 15`);
    console.log(`  - Total watches: ${totalWatches}x`);
    console.log(`  - Avg watch time: 96m`);
    console.log(`  - Score: 15 × 2 + ${totalWatches} = ${score} points`);
    console.log(`\n🏆 With score of ${score}, this should DOMINATE the rankings!`);
    console.log(`🔄 Restart server now!\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

setExact148();
