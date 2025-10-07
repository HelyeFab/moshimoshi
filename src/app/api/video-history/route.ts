import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStorageDecision } from '@/lib/api/storage-helper';
import { adminFirestore as adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/video-history
 * Load user's video history from Firebase (premium users only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const storageDecision = await getStorageDecision(session);

    if (!storageDecision.isPremium || !adminDb) {
      // Free users or no Firebase: return empty
      return NextResponse.json({
        videoIds: [],
        lastUpdated: new Date().toISOString()
      });
    }

    try {
      const docRef = adminDb.collection('userVideoHistory').doc(session.uid);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();
        return NextResponse.json({
          videoIds: data?.videoIds || [],
          lastUpdated: data?.lastUpdated || new Date().toISOString()
        });
      }

      return NextResponse.json({
        videoIds: [],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('[API] Error loading video history from Firebase:', error);
      return NextResponse.json({
        videoIds: [],
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error('[API] Error in video-history GET:', error);
    return NextResponse.json(
      { error: 'Failed to load video history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/video-history
 * Add a video to user's history (premium users get Firebase sync)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId' },
        { status: 400 }
      );
    }

    const storageDecision = await getStorageDecision(session);

    // Only sync to Firebase for premium users
    if (storageDecision.isPremium && adminDb) {
      try {
        const docRef = adminDb.collection('userVideoHistory').doc(session.uid);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          // Update existing document
          const currentData = docSnap.data();
          const currentVideoIds = currentData?.videoIds || [];

          if (!currentVideoIds.includes(videoId)) {
            await docRef.update({
              videoIds: [...currentVideoIds, videoId],
              lastUpdated: new Date().toISOString()
            });
            console.log(`[API] ✅ Added video ${videoId} to Firebase history`);
          }
        } else {
          // Create new document
          await docRef.set({
            videoIds: [videoId],
            lastUpdated: new Date().toISOString()
          });
          console.log(`[API] ✅ Created Firebase history with video ${videoId}`);
        }
      } catch (error) {
        console.error('[API] ⚠️ Firebase sync failed (non-critical):', error);
        // Don't fail the request - local storage still works
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Video added to history'
    });
  } catch (error: any) {
    console.error('[API] Error in video-history POST:', error);
    return NextResponse.json(
      { error: 'Failed to add video to history' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/video-history
 * Force sync all local video IDs to Firebase (for premium users)
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { videoIds } = body;

    if (!Array.isArray(videoIds)) {
      return NextResponse.json(
        { error: 'Invalid videoIds array' },
        { status: 400 }
      );
    }

    const storageDecision = await getStorageDecision(session);

    if (!storageDecision.isPremium || !adminDb) {
      return NextResponse.json({
        success: false,
        message: 'Premium subscription required for cloud sync'
      }, { status: 403 });
    }

    try {
      const docRef = adminDb.collection('userVideoHistory').doc(session.uid);

      await docRef.set({
        videoIds: videoIds,
        lastUpdated: new Date().toISOString()
      }, { merge: false }); // Replace instead of merge

      console.log(`[API] ✅ Force synced ${videoIds.length} videos to Firebase`);

      return NextResponse.json({
        success: true,
        message: `Synced ${videoIds.length} videos to cloud`
      });
    } catch (error) {
      console.error('[API] Error force syncing to Firebase:', error);
      throw error;
    }
  } catch (error: any) {
    console.error('[API] Error in video-history PUT:', error);
    return NextResponse.json(
      { error: 'Failed to sync video history' },
      { status: 500 }
    );
  }
}
