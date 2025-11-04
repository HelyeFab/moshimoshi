import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { prepareFirestoreData, cleanYouTubeMetadata } from '@/lib/firebase/cleanFirestoreData';

export async function POST(req: NextRequest) {
  console.log('[Practice Track] ========== POST REQUEST RECEIVED ==========');
  try {
    // Get session
    const session = await getSession();
    console.log('[Practice Track] Session:', session ? `User ${session.uid}` : 'No session');

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
          await docRef.update(prepareFirestoreData({
            lastWatched: Timestamp.now(),
            watchCount: (existingData?.watchCount || 0) + 1,
            totalWatchTime: (existingData?.totalWatchTime || 0) + (practiceTime || 0),
            updatedAt: Timestamp.now()
          }));
        } else {
          // Create new video entry
          const cleanedMetadata = cleanYouTubeMetadata(metadata);
          await docRef.set(prepareFirestoreData({
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
            metadata: cleanedMetadata,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          }));
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
        console.log(`[Practice Track] Saving to userPracticeHistory: ${statsDocId}`);
        const statsDocSnap = await statsDocRef.get();

        if (statsDocSnap.exists) {
          const existingStats = statsDocSnap.data();

          // Prepare update data
          const updateData: any = {
            userId: session.uid,
            lastPracticed: Timestamp.now(),
            practiceCount: (existingStats?.practiceCount || 0) + 1,
            totalPracticeTime: (existingStats?.totalPracticeTime || 0) + (practiceTime || 0),
            updatedAt: Timestamp.now()
          };

          // Set firstPracticed if this is the first time watching for 30+ seconds
          if (!existingStats?.firstPracticed) {
            updateData.firstPracticed = Timestamp.now();
            console.log(`[Practice Track] Setting firstPracticed for ${statsDocId}`);
          }

          // MIGRATION: Set firstAccessed if missing (lazy migration for old docs)
          if (!existingStats?.firstAccessed && existingStats?.firstPracticed) {
            updateData.firstAccessed = existingStats.firstPracticed;
            console.log(`[Practice Track] [MIGRATION] Setting firstAccessed from firstPracticed for ${statsDocId}`);
          }

          await statsDocRef.update(updateData);
          console.log(`[Practice Track] ✅ Updated userPracticeHistory for ${statsDocId}`);
        } else {
          // LEGACY FALLBACK: Create doc if it doesn't exist
          // This should rarely happen now since /api/youtube/extract creates the doc
          console.log(`[Practice Track] ⚠️  [LEGACY] Creating userPracticeHistory (should have been created by /api/youtube/extract)`);
          await statsDocRef.set({
            userId: session.uid,
            videoId: `youtube_${videoId}`,
            contentType: 'youtube',
            firstAccessed: Timestamp.now(), // NEW FIELD
            firstPracticed: Timestamp.now(),
            lastPracticed: Timestamp.now(),
            practiceCount: 1,
            totalPracticeTime: practiceTime || 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          console.log(`[Practice Track] ✅ Created userPracticeHistory (legacy fallback) for ${statsDocId}`);
        }
      } catch (error) {
        console.error('[Practice Track] ❌ Error saving practice stats to Firebase:', error);
        console.error('[Practice Track] Error details:', {
          message: error.message,
          code: error.code,
          stack: error.stack?.split('\n')[0]
        });
      }
    } else {
      console.log(`[Practice Track] Skipping userPracticeHistory - session: ${!!session}, adminDb: ${!!adminDb}`);
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
            lastPracticed: data.lastWatched?.toDate() || new Date(),
            firstPracticed: data.firstWatched?.toDate() || new Date(),
            practiceCount: data.watchCount || 1,
            totalPracticeTime: data.totalWatchTime || 0,
            duration: data.duration,
            thumbnailUrl: data.thumbnailUrl,
            channelName: data.channelName,
            metadata: data.metadata
          };
        });

        // Sort videos by lastPracticed if we couldn't do it in the query
        videos.sort((a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime());
      } catch (error) {
        console.error('Error fetching YouTube history from Firebase:', error);
      }
    }

    // Calculate aggregate statistics
    const stats = {
      totalVideos: videos.length,
      totalPracticeCount: videos.reduce((sum, v) => sum + (v.practiceCount || 0), 0),
      totalPracticeTime: videos.reduce((sum, v) => sum + (v.totalPracticeTime || 0), 0)
    };

    return NextResponse.json({
      success: true,
      items: videos,
      userTier,
      count: videos.length,
      stats,
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