import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/kanji/bookmarks
 * Get all user's bookmarked kanji
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bookmarksSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .orderBy('bookmarkedAt', 'desc')
      .get();

    const bookmarks = bookmarksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      bookmarks,
      total: bookmarks.length
    });

  } catch (error) {
    console.error('[Bookmarks GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kanji/bookmarks
 * Add a bookmark
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kanjiId, character, notes, tags, priority } = body;

    if (!kanjiId || !character) {
      return NextResponse.json(
        { error: 'kanjiId and character are required' },
        { status: 400 }
      );
    }

    // Check bookmark limits based on tier
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();
    const isPremium = userData?.subscription?.plan === 'premium_monthly' ||
                      userData?.subscription?.plan === 'premium_yearly';

    // Count existing bookmarks
    const bookmarksSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .get();

    const currentCount = bookmarksSnapshot.size;
    const limit = isPremium ? -1 : 20; // Free users limited to 20 bookmarks

    if (!isPremium && currentCount >= limit) {
      return NextResponse.json(
        {
          error: 'Bookmark limit reached',
          limit,
          current: currentCount,
          message: 'Upgrade to premium for unlimited bookmarks'
        },
        { status: 429 }
      );
    }

    // Add bookmark
    const timestamp = FieldValue.serverTimestamp();
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .doc(kanjiId)
      .set({
        character,
        bookmarkedAt: timestamp,
        tags: tags || [],
        notes: notes || '',
        priority: priority || 'medium',
        addedToReview: false,
        lastViewed: timestamp
      });

    // Update achievement tracking
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')
      .set({
        kanjiBookmarked: FieldValue.increment(1),
        lastUpdated: timestamp
      }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Kanji bookmarked successfully',
      bookmarkCount: currentCount + 1
    });

  } catch (error) {
    console.error('[Bookmark POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to add bookmark', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kanji/bookmarks
 * Remove a bookmark
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const kanjiId = searchParams.get('kanjiId');

    if (!kanjiId) {
      return NextResponse.json(
        { error: 'kanjiId is required' },
        { status: 400 }
      );
    }

    // Delete bookmark
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .doc(kanjiId)
      .delete();

    // Update achievement tracking
    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('achievements')
      .doc('data')
      .set({
        kanjiBookmarked: FieldValue.increment(-1),
        lastUpdated: FieldValue.serverTimestamp()
      }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed successfully'
    });

  } catch (error) {
    console.error('[Bookmark DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove bookmark', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/kanji/bookmarks
 * Update a bookmark (notes, tags, priority)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kanjiId, notes, tags, priority } = body;

    if (!kanjiId) {
      return NextResponse.json(
        { error: 'kanjiId is required' },
        { status: 400 }
      );
    }

    const updates: any = {
      lastViewed: FieldValue.serverTimestamp()
    };

    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;
    if (priority !== undefined) updates.priority = priority;

    await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .doc(kanjiId)
      .update(updates);

    return NextResponse.json({
      success: true,
      message: 'Bookmark updated successfully'
    });

  } catch (error) {
    console.error('[Bookmark PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update bookmark', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}