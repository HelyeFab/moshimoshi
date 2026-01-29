import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { trackUserActivity } from '@/lib/admin/trackActivity';

/**
 * POST /api/track-view
 * Lightweight endpoint to track content views without fetching content
 *
 * This is called separately from content fetching to ensure view counts
 * are tracked even when content is served from cache (PWA/offline)
 *
 * Includes deduplication to prevent double-counting from React Strict Mode
 * or rapid duplicate requests
 */

// In-memory deduplication cache (clears on server restart, which is fine)
const recentViews = new Map<string, number>();
const DEDUP_WINDOW_MS = 3000; // 3 seconds

function isDuplicateView(userId: string, contentType: string, contentId: string): boolean {
  const key = `${userId}:${contentType}:${contentId}`;
  const lastView = recentViews.get(key);
  const now = Date.now();

  if (lastView && (now - lastView) < DEDUP_WINDOW_MS) {
    return true; // Duplicate within window
  }

  // Update last view time
  recentViews.set(key, now);

  // Clean up old entries (older than 10 seconds)
  if (recentViews.size > 1000) {
    const cutoff = now - 10000;
    for (const [k, time] of recentViews.entries()) {
      if (time < cutoff) {
        recentViews.delete(k);
      }
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentType, contentId } = body;

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: 'contentType and contentId are required' },
        { status: 400 }
      );
    }

    // Validate content type
    const validTypes = ['books', 'stories', 'comics', 'news_articles'];
    if (!validTypes.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid contentType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!adminFirestore) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Check for duplicate view (React Strict Mode, double-clicks, etc.)
    if (isDuplicateView(session.uid, contentType, contentId)) {
      console.log('[Track View] Ignoring duplicate view:', { contentType, contentId });
      return NextResponse.json({
        success: true,
        message: 'Duplicate view ignored',
        contentType,
        contentId,
        deduplicated: true
      });
    }

    // Track user activity (non-blocking)
    trackUserActivity(session.uid).catch(console.error);

    // Map content type to collection name
    const collectionName = contentType === 'news_articles' ? 'news_articles' : contentType;

    // Increment view count atomically
    const docRef = adminFirestore.collection(collectionName).doc(contentId);

    await docRef.update({
      viewCount: FieldValue.increment(1),
      lastViewed: new Date()
    }).catch(async (err) => {
      // If document doesn't exist or doesn't have viewCount field, initialize it
      if (err.code === 'not-found' || err.message.includes('No document to update')) {
        console.warn(`[Track View] Document not found: ${collectionName}/${contentId}`);
        return;
      }

      // Try to set the field if it doesn't exist
      try {
        await docRef.set({
          viewCount: 1,
          lastViewed: new Date()
        }, { merge: true });
      } catch (setErr) {
        console.error('[Track View] Failed to initialize viewCount:', setErr);
      }
    });

    // Track daily content views (UTC)
    const dateKey = new Date().toISOString().slice(0, 10);
    const dailyDocId = `${dateKey}__${collectionName}__${contentId}`;
    await adminFirestore.collection('content_view_daily').doc(dailyDocId).set({
      date: dateKey,
      contentType: collectionName,
      contentId,
      totalViews: FieldValue.increment(1),
      lastViewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'View tracked',
      contentType,
      contentId
    });

  } catch (error) {
    console.error('[Track View] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track view'
      },
      { status: 500 }
    );
  }
}
