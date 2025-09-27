import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Check storage decision for premium status
    let storageDecision = null;
    let userTier = 'guest';

    if (session) {
      storageDecision = await getStorageDecision(session);
      userTier = storageDecision.plan;
    }


    // Parse request body
    const body = await req.json();
    const {
      videoUrl,
      videoTitle,
      videoId,
      thumbnailUrl,
      channelName,
      duration,
      practiceTime,
      metadata
    } = body;

    // Validate required fields
    if (!videoUrl || !videoTitle || !videoId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Save video history for premium users
    if (session && storageDecision?.isPremium && adminDb) {
      const docId = `${session.uid}_${videoId}`;
      const docRef = adminDb.collection('userYouTubeHistory').doc(docId);

      try {
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          // Update existing video
          const existingData = docSnap.data();
          await docRef.update({
            lastWatched: Timestamp.now(),
            watchCount: (existingData?.watchCount || 0) + 1,
            totalWatchTime: (existingData?.totalWatchTime || 0) + (practiceTime || 0),
            updatedAt: Timestamp.now()
          });
        } else {
          // Create new video entry
          await docRef.set({
            userId: session.uid,
            videoId,
            videoUrl,
            videoTitle,
            thumbnailUrl,
            channelName,
            lastWatched: Timestamp.now(),
            firstWatched: Timestamp.now(),
            watchCount: 1,
            totalWatchTime: practiceTime || 0,
            duration,
            metadata,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        }
      } catch (error) {
        console.error('Error saving YouTube video to Firebase:', error);
      }
    }

    // Save practice stats for leaderboard (all authenticated users)
    if (session && adminDb) {
      const statsDocId = `${session.uid}_${videoId}`;
      const statsDocRef = adminDb.collection('userPracticeHistory').doc(statsDocId);

      try {
        const statsDocSnap = await statsDocRef.get();

        if (statsDocSnap.exists) {
          const existingStats = statsDocSnap.data();
          await statsDocRef.update({
            userId: session.uid,
            lastPracticed: Timestamp.now(),
            practiceCount: (existingStats?.practiceCount || 0) + 1,
            totalPracticeTime: (existingStats?.totalPracticeTime || 0) + (practiceTime || 0),
            updatedAt: Timestamp.now()
          });
        } else {
          await statsDocRef.set({
            userId: session.uid,
            videoId: `youtube_${videoId}`,
            contentType: 'youtube',
            lastPracticed: Timestamp.now(),
            firstPracticed: Timestamp.now(),
            practiceCount: 1,
            totalPracticeTime: practiceTime || 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        }
      } catch (error) {
        console.error('Error saving practice stats to Firebase:', error);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Practice tracked successfully'
    });
  } catch (error: any) {
    console.error('Error tracking practice:', error);
    return NextResponse.json(
      { error: 'Failed to track practice' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Check storage decision for premium status
    let storageDecision = null;
    let userTier = 'guest';

    if (session) {
      storageDecision = await getStorageDecision(session);
      userTier = storageDecision.plan;
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get video history from Firebase (premium users only)
    let videos = [];

    if (session && storageDecision?.isPremium && adminDb) {
      try {
        // First try with ordering, fall back to simple query if index missing
        let querySnapshot;
        try {
          querySnapshot = await adminDb
            .collection('userYouTubeHistory')
            .where('userId', '==', session.uid)
            .orderBy('lastWatched', 'desc')
            .limit(limit)
            .get();
        } catch (indexError: any) {
          // If index error, fall back to simple query without ordering
          if (indexError.code === 9) {
            console.log('Index missing, using simple query without ordering');
            querySnapshot = await adminDb
              .collection('userYouTubeHistory')
              .where('userId', '==', session.uid)
              .limit(limit)
              .get();
          } else {
            throw indexError;
          }
        }

        videos = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            videoId: data.videoId,
            videoUrl: data.videoUrl,
            videoTitle: data.videoTitle,
            lastWatched: data.lastWatched?.toDate() || new Date(),
            firstWatched: data.firstWatched?.toDate() || new Date(),
            watchCount: data.watchCount || 1,
            totalWatchTime: data.totalWatchTime,
            duration: data.duration,
            thumbnailUrl: data.thumbnailUrl,
            channelName: data.channelName,
            metadata: data.metadata
          };
        });

        // Sort videos by lastWatched if we couldn't do it in the query
        if (!videos[0]?.lastWatched) {
          videos.sort((a, b) => new Date(b.lastWatched).getTime() - new Date(a.lastWatched).getTime());
        }
      } catch (error) {
        console.error('Error fetching YouTube history from Firebase:', error);
      }
    }

    return NextResponse.json({
      success: true,
      items: videos,
      userTier,
      count: videos.length,
      storage: {
        location: storageDecision?.storageLocation || 'local',
        isPremium: storageDecision?.isPremium || false
      }
    });
  } catch (error: any) {
    console.error('Error fetching practice history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practice history' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Get session
    const session = await getSession();

    // Parse request body
    const body = await req.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    // Delete video from Firebase (premium users only)
    if (session && adminDb) {
      const storageDecision = await getStorageDecision(session);

      if (storageDecision.isPremium) {
        try {
          const docId = `${session.uid}_${videoId}`;
          const docRef = adminDb.collection('userYouTubeHistory').doc(docId);

          const docSnap = await docRef.get();
          if (docSnap.exists) {
            await docRef.delete();
          }
        } catch (error) {
          console.error('Error deleting YouTube video from Firebase:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Practice history item deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting practice history item:', error);
    return NextResponse.json(
      { error: 'Failed to delete practice history item' },
      { status: 500 }
    );
  }
}