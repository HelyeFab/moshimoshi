import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminFirestore as adminDb, Timestamp, FieldValue } from '@/lib/firebase/admin';
import { youtubeClient, getYouTubeApiKey, YOUTUBE_FIELDS } from '@/lib/youtube/client';

// Check if user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    if (!adminDb) return false;
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.isAdmin === true || userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check session and admin status
    const session = await getSession();

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const isAdmin = await isUserAdmin(session.uid);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    const { channelId } = await request.json();

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    // Get channel document from Firestore
    const channelDoc = await adminDb.collection('youtubeChannels').doc(channelId).get();

    if (!channelDoc.exists) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }

    const channelData = channelDoc.data();
    if (!channelData) {
      return NextResponse.json(
        { error: 'Channel data not found' },
        { status: 404 }
      );
    }
    const API_KEY = getYouTubeApiKey();

    if (!API_KEY) {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    // Create import log
    const importLogRef = adminDb.collection('youtubeImportLogs').doc();
    await importLogRef.set({
      channelId: channelId,
      startedAt: Timestamp.now(),
      status: 'processing',
      videosChecked: 0,
      videosImported: 0,
      videosSkipped: 0,
      youtubeApiCalls: 0,
      triggeredBy: 'manual',
      executedBy: session.uid
    });

    try {
      // Fetch latest videos from the channel (with retry logic)
      const searchResponse = await youtubeClient.get('/search', {
        params: {
          part: 'snippet',
          channelId: channelData.channelId,
          order: 'date',
          maxResults: 10, // Fetch latest 10 videos
          type: 'video',
          key: API_KEY,
          fields: YOUTUBE_FIELDS.SEARCH_RESULTS,
        }
      });

      let apiCalls = 1;
      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId);

      if (videoIds.length === 0) {
        await importLogRef.update({
          completedAt: Timestamp.now(),
          status: 'completed',
          youtubeApiCalls: apiCalls
        });

        return NextResponse.json({
          success: true,
          channelTitle: channelData.channelTitle,
          videosAdded: 0,
          videosUpdated: 0,
          message: 'No videos found for this channel'
        });
      }

      // Fetch detailed video information (with retry logic and optimized fields)
      const videosResponse = await youtubeClient.get('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoIds.join(','),
          key: API_KEY,
          fields: YOUTUBE_FIELDS.VIDEO_DETAILS,
        }
      });

      apiCalls++;

      let videosAdded = 0;
      let videosUpdated = 0;
      let videosSkipped = 0;

      // Process each video
      for (const video of videosResponse.data.items) {
        const videoId = video.id;

        // Check if video already exists
        const existingVideoQuery = await adminDb
          .collection('youtubeVideoResources')
          .where('videoId', '==', videoId)
          .limit(1)
          .get();

        const duration = parseDuration(video.contentDetails.duration);

        const videoData = {
          videoId: videoId,
          channelId: channelData.channelId,
          title: video.snippet.title,
          description: video.snippet.description || '',
          thumbnailUrl: video.snippet.thumbnails?.maxres?.url ||
                       video.snippet.thumbnails?.high?.url ||
                       video.snippet.thumbnails?.medium?.url ||
                       '',
          duration: duration,
          publishedAt: Timestamp.fromDate(new Date(video.snippet.publishedAt)),
          viewCount: parseInt(video.statistics.viewCount || '0'),
          likeCount: parseInt(video.statistics.likeCount || '0'),
          channelTitle: channelData.channelTitle,
          transcriptCached: false,
          shadowingUrl: `/youtube-shadowing?v=${videoId}`,
          shadowingSessionCount: 0,
          resourceViews: 0,
          shadowingStarts: 0,
          shadowingCompletions: 0,
          importedBy: session.uid,
          autoImported: true,
          isCurated: false,  // Not curated by default - admin must manually select
        };

        if (existingVideoQuery.empty) {
          // Add new video
          await adminDb.collection('youtubeVideoResources').add({
            ...videoData,
            importedAt: Timestamp.now()
          });
          videosAdded++;
        } else {
          // Update existing video
          const existingDoc = existingVideoQuery.docs[0];
          await existingDoc.ref.update({
            ...videoData,
            updatedAt: Timestamp.now()
          });
          videosUpdated++;
        }
      }

      // Update channel's last check and video count
      await adminDb.collection('youtubeChannels').doc(channelId).update({
        lastCheckedAt: Timestamp.now(),
        lastVideoId: videoIds[0] || null,
        videosImported: FieldValue.increment(videosAdded),
        updatedAt: Timestamp.now()
      });

      // Complete import log
      await importLogRef.update({
        completedAt: Timestamp.now(),
        status: 'completed',
        videosChecked: videosResponse.data.items.length,
        videosImported: videosAdded,
        videosSkipped: videosSkipped,
        youtubeApiCalls: apiCalls
      });

      return NextResponse.json({
        success: true,
        channelTitle: channelData.channelTitle,
        videosAdded,
        videosUpdated,
        totalProcessed: videosAdded + videosUpdated
      });

    } catch (error: any) {
      // Update import log with error
      await importLogRef.update({
        completedAt: Timestamp.now(),
        status: 'failed',
        errors: [error.message || 'Unknown error']
      });

      throw error;
    }

  } catch (error: any) {
    console.error('Error syncing YouTube channel:', error);

    if (error.response?.status === 403) {
      return NextResponse.json(
        { error: 'YouTube API quota exceeded' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to sync channel' },
      { status: 500 }
    );
  }
}

// Parse YouTube duration format (PT15M33S) to seconds
function parseDuration(duration: string): number {
  if (!duration) return 0;

  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;

  const hours = match[1] ? parseInt(match[1].slice(0, -1)) : 0;
  const minutes = match[2] ? parseInt(match[2].slice(0, -1)) : 0;
  const seconds = match[3] ? parseInt(match[3].slice(0, -1)) : 0;

  return hours * 3600 + minutes * 60 + seconds;
}