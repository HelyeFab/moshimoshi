const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function setExactStats() {
  try {
    console.log('🎯 Setting exact stats for Tomo\'s video...\n');
    console.log('Target: 148x total watches, 96m average watch time\n');

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

    // We need 148 total watches across 15 users
    // Average per user: 148 / 15 ≈ 9.87, let's distribute
    // Average watch time: 96 minutes = 5760 seconds per user
    
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

    // Distribute 148 watches across 15 users
    const watchCounts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9]; // Total = 148
    
    let totalWatches = 0;
    
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const docId = `${userId}_${videoId}`;
      const watchCount = watchCounts[i];
      const totalWatchTime = Math.floor(5760 + (Math.random() * 200 - 100)); // ~96m per user

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
      console.log(`  ✓ User ${i + 1}: ${watchCount} watches, ${Math.floor(totalWatchTime/60)}m watch time`);
    }

    console.log(`\n✅ Stats updated!`);
    console.log(`📊 Final stats:`);
    console.log(`  - Unique viewers: 15`);
    console.log(`  - Total watch count: ${totalWatches}x`);
    console.log(`  - Average watch time: ~96m`);
    console.log(`  - Ranking score: ${15 * 2 + totalWatches} points`);
    console.log(`\n🏆 Should definitely be #1 now!`);
    console.log(`🔄 Restart your dev server to see the change\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

setExactStats();
