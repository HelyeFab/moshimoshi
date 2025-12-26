const admin = require('firebase-admin');
const serviceAccount = require('../moshimoshi-service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addTomoVideo() {
  try {
    console.log('🎬 Adding Tomo\'s video to trending...\n');

    const videoId = 'ofkWnxFRclY';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Fetch video metadata from YouTube API
    console.log('📡 Fetching video metadata...');
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY environment variable is required');
    }

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found on YouTube');
    }

    const video = data.items[0];
    const videoTitle = video.snippet.title;
    const channelName = video.snippet.channelTitle;
    const thumbnailUrl = video.snippet.thumbnails?.maxres?.url ||
                        video.snippet.thumbnails?.high?.url ||
                        video.snippet.thumbnails?.medium?.url;

    console.log(`✅ Found: ${videoTitle}`);
    console.log(`📺 Channel: ${channelName}\n`);

    // Create multiple user history entries to make it trending
    // This simulates 5 different users watching the video
    const userIds = [
      'trending_user_1',
      'trending_user_2',
      'trending_user_3',
      'trending_user_4',
      'trending_user_5'
    ];

    console.log('💾 Adding to userYouTubeHistory collection...');

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      const docId = `${userId}_${videoId}`;

      await db.collection('userYouTubeHistory').doc(docId).set({
        userId,
        videoId,
        videoUrl,
        videoTitle,
        channelName,
        thumbnailUrl,
        watchCount: Math.floor(Math.random() * 3) + 2, // 2-4 watches
        totalWatchTime: Math.floor(Math.random() * 600) + 300, // 5-15 minutes
        lastWatched: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.Timestamp.now()
      });

      console.log(`  ✓ Added entry for user ${i + 1}/5`);
    }

    console.log('\n🎉 Success! Video added to trending.');
    console.log('🔥 The video should now appear with "🔥 Trending" badge');
    console.log('\n📊 Stats:');
    console.log(`  - Unique viewers: 5`);
    console.log(`  - Will rank high in trending list`);
    console.log(`  - Cache will refresh in ~1 hour\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

addTomoVideo();
