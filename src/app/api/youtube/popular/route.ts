import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore as adminDb, Timestamp } from '@/lib/firebase/admin';
import { getStorageDecision } from '@/lib/api/storage-helper';

// Curated starter videos for when we have low data
const CURATED_STARTER_VIDEOS = [
  {
    videoId: 'dD2EISUDjVE',
    videoUrl: 'https://www.youtube.com/watch?v=dD2EISUDjVE',
    videoTitle: 'Japanese Listening Practice for Beginners',
    channelName: 'Japonin',
    thumbnailUrl: 'https://i.ytimg.com/vi/dD2EISUDjVE/maxresdefault.jpg',
    uniqueViewers: 0,
    totalWatchCount: 0,
    isCurated: true,
    badge: '👋 Starter'
  },
  {
    videoId: 'K_EyIFRIvO4',
    videoUrl: 'https://www.youtube.com/watch?v=K_EyIFRIvO4',
    videoTitle: 'Learn Japanese While Sleeping',
    channelName: 'Learn Japanese with JapanesePod101.com',
    thumbnailUrl: 'https://i.ytimg.com/vi/K_EyIFRIvO4/maxresdefault.jpg',
    uniqueViewers: 0,
    totalWatchCount: 0,
    isCurated: true,
    badge: '👋 Starter'
  },
  {
    videoId: 'uk7gKixqVNU',
    videoUrl: 'https://www.youtube.com/watch?v=uk7gKixqVNU',
    videoTitle: 'Japanese Conversation Practice',
    channelName: 'Miku Real Japanese',
    thumbnailUrl: 'https://i.ytimg.com/vi/uk7gKixqVNU/maxresdefault.jpg',
    uniqueViewers: 0,
    totalWatchCount: 0,
    isCurated: true,
    badge: '👋 Starter'
  }
];

// Cache for popular videos
let cachedVideos: any = null;
let cacheExpiry: Date | null = null;

async function aggregatePopularVideos(minViewers: number = 3) {
  try {
    // Get all videos from userYouTubeHistory
    const snapshot = await adminDb.collection('userYouTubeHistory').get();

    // Aggregate by videoId
    const videoMap = new Map<string, any>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const videoId = data.videoId;

      if (!videoMap.has(videoId)) {
        videoMap.set(videoId, {
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          thumbnailUrl: data.thumbnailUrl || '',
          channelName: data.channelName || 'Unknown Channel',
          uniqueViewers: new Set(),
          totalWatchCount: 0,
          totalWatchTime: 0,
          lastWatched: data.lastWatched?.toDate() || new Date()
        });
      }

      const video = videoMap.get(videoId);
      video.uniqueViewers.add(data.userId);
      video.totalWatchCount += data.watchCount || 1;
      video.totalWatchTime += data.totalWatchTime || 0;

      // Update last watched if more recent
      const lastWatched = data.lastWatched?.toDate() || new Date();
      if (lastWatched > video.lastWatched) {
        video.lastWatched = lastWatched;
      }
    });

    // Convert to array and filter by minimum viewers
    let videos = Array.from(videoMap.values())
      .map(v => ({
        ...v,
        uniqueViewers: v.uniqueViewers.size,
        averageWatchTime: v.uniqueViewers.size > 0
          ? Math.round(v.totalWatchTime / v.uniqueViewers.size)
          : 0
      }))
      .filter(v => v.uniqueViewers >= minViewers);

    // Sort by popularity (weighted by unique viewers and total watches)
    videos.sort((a, b) => {
      const scoreA = (a.uniqueViewers * 2) + a.totalWatchCount;
      const scoreB = (b.uniqueViewers * 2) + b.totalWatchCount;
      return scoreB - scoreA;
    });

    return videos;
  } catch (error) {
    console.error('Error aggregating popular videos:', error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get session for quota information
    const session = await getSession();

    // Check storage decision for user tier
    let storageDecision = null;
    let userTier = 'guest';
    let quotaLimit = 0;
    let quotaUsed = 0;

    if (session) {
      storageDecision = await getStorageDecision(session);
      userTier = storageDecision.plan;

      // Get quota limits based on plan
      switch (userTier) {
        case 'free':
          quotaLimit = 3;
          break;
        case 'premium_monthly':
        case 'premium_yearly':
          quotaLimit = 20;
          break;
        default:
          quotaLimit = 0;
      }

      // Get today's usage count
      if (quotaLimit > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Simplified query to avoid index requirement
        const practiceSnapshot = await adminDb
          .collection('userPracticeHistory')
          .where('userId', '==', session.uid)
          .get();

        // Filter in memory for today's YouTube videos
        const todayTimestamp = Timestamp.fromDate(today);
        quotaUsed = practiceSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.contentType === 'youtube' &&
                 data.lastPracticed &&
                 data.lastPracticed.seconds >= todayTimestamp.seconds;
        }).length;
      }
    }

    // Check cache first
    if (cachedVideos && cacheExpiry && cacheExpiry > new Date()) {
      return NextResponse.json({
        success: true,
        videos: cachedVideos,
        userQuota: {
          used: quotaUsed,
          limit: quotaLimit,
          remaining: Math.max(0, quotaLimit - quotaUsed)
        },
        cached: true
      });
    }

    // Aggregate popular videos
    // Just show whatever videos we have in the database, no minimum requirement
    let videos = await aggregatePopularVideos(1); // Start with 1 viewer minimum

    // If no videos at all, return empty array
    if (videos.length === 0) {
      console.log('No videos found in database');
    } else {
      console.log(`Found ${videos.length} video(s) in database`);
    }

    // Mark videos as trending or suggested
    videos = videos.map((v, index) => ({
      ...v,
      rank: index + 1,
      isTrending: v.uniqueViewers >= 3,
      badge: v.uniqueViewers >= 3 ? '🔥 Trending' : '✨ Suggested'
    }));

    // Take top 12 videos
    videos = videos.slice(0, 12);

    // Cache the results for 1 hour
    cachedVideos = videos;
    cacheExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return NextResponse.json({
      success: true,
      videos,
      userQuota: {
        used: quotaUsed,
        limit: quotaLimit,
        remaining: Math.max(0, quotaLimit - quotaUsed)
      },
      cached: false
    });
  } catch (error: any) {
    console.error('Error fetching popular videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular videos' },
      { status: 500 }
    );
  }
}