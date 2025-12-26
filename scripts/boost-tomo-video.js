const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function boostTomoVideo() {
  try {
    console.log('🚀 Boosting Tomo\'s video to rank #1...\n');

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

    console.log(`📺 Video: ${videoTitle}`);
    console.log(`👥 Adding 10 more users (total 15 users)\n`);

    // Add 10 more users with high watch counts
    const newUserIds = [
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

    for (let i = 0; i < newUserIds.length; i++) {
      const userId = newUserIds[i];
      const docId = `${userId}_${videoId}`;

      await db.collection('userYouTubeHistory').doc(docId).set({
        userId,
        videoId,
        videoUrl,
        videoTitle,
        channelName,
        thumbnailUrl,
        watchCount: Math.floor(Math.random() * 5) + 3, // 3-7 watches
        totalWatchTime: Math.floor(Math.random() * 900) + 600, // 10-25 minutes
        lastWatched: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now()
      });

      console.log(`  ✓ Added user ${6 + i}/15`);
    }

    console.log('\n🎉 Video boosted successfully!');
    console.log('📊 New stats:');
    console.log('  - Total unique viewers: 15');
    console.log('  - Score formula: (viewers × 2) + totalWatchCount');
    console.log('  - Estimated score: ~100+');
    console.log('\n🏆 This should make it rank #1!');
    console.log('🔄 Restart your dev server to see the change\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

boostTomoVideo();
