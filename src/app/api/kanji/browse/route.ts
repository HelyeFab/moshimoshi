import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/kanji/browse
 * Browse kanji with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      jlpt: searchParams.get('jlpt'),
      grade: searchParams.get('grade'),
      strokes: searchParams.get('strokes'),
      search: searchParams.get('q'),
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('size') || '20')
    };

    console.log('[Kanji Browse] Request with filters:', filters);

    // Return empty data since the page loads kanji from local files via kanjiService
    // This endpoint is only called by the useKanjiBrowser hook which we're not using for loading
    return NextResponse.json({
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      hasMore: false
    });

    // Original query code commented out as we don't have kanji in Firestore
    /*
    // Build query
    let query = adminDb.collection('kanji') as any;

    if (filters.jlpt) {
      query = query.where('jlptLevel', '==', parseInt(filters.jlpt));
    }
    if (filters.grade) {
      query = query.where('grade', '==', parseInt(filters.grade));
    }
    if (filters.strokes) {
      const [min, max] = filters.strokes.split('-').map(Number);
      query = query.where('strokeCount', '>=', min);
      if (max) {
        query = query.where('strokeCount', '<=', max);
      }
    }

    // Get user's progress for these kanji
    const progressDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('progress')
      .doc('kanji')
      .get();

    const userProgress = progressDoc.data()?.items || {};

    // Get user's bookmarks
    const bookmarksSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('kanji_bookmarks')
      .get();

    const bookmarks = new Set(bookmarksSnapshot.docs.map(doc => doc.id));

    // Execute query with pagination
    const snapshot = await query
      .orderBy('frequency', 'asc')
      .orderBy('jlptLevel', 'asc')
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize)
      .get();

    const kanjiList = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      progress: userProgress[doc.id] || null,
      bookmarked: bookmarks.has(doc.id)
    }));

    // If search query provided, filter results
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const filtered = kanjiList.filter((kanji: any) => {
        return (
          kanji.character?.includes(filters.search) ||
          kanji.meanings?.some((m: string) => m.toLowerCase().includes(searchLower)) ||
          kanji.onyomi?.some((r: string) => r.toLowerCase().includes(searchLower)) ||
          kanji.kunyomi?.some((r: string) => r.toLowerCase().includes(searchLower))
        );
      });

      return NextResponse.json({
        items: filtered,
        page: filters.page,
        pageSize: filters.pageSize,
        hasMore: snapshot.docs.length === filters.pageSize,
        totalFiltered: filtered.length
      });
    }

    return NextResponse.json({
      items: kanjiList,
      page: filters.page,
      pageSize: filters.pageSize,
      hasMore: snapshot.docs.length === filters.pageSize
    });
    */

  } catch (error) {
    console.error('[Kanji Browse] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kanji', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kanji/browse
 * Track browse events
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kanjiIds, action } = body;

    if (!kanjiIds || !Array.isArray(kanjiIds) || kanjiIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: kanjiIds array required' },
        { status: 400 }
      );
    }

    const timestamp = FieldValue.serverTimestamp();

    // Track browse events
    if (action === 'browse') {
      const batch = adminDb.batch();

      for (const kanjiId of kanjiIds) {
        // Add to browse history
        const historyRef = adminDb
          .collection('users')
          .doc(session.uid)
          .collection('kanji_browse_history')
          .doc();

        batch.set(historyRef, {
          kanjiId,
          character: body.characters?.[kanjiId] || body.character || kanjiId, // Fallback to kanjiId if character not provided
          timestamp,
          source: body.source || 'browse',
          sessionId: body.sessionId,
          deviceType: body.deviceType || 'desktop'
        });

        // Update progress tracking
        const progressRef = adminDb
          .collection('users')
          .doc(session.uid)
          .collection('progress')
          .doc('kanji');

        batch.set(progressRef, {
          [`items.${kanjiId}.lastBrowsed`]: timestamp,
          [`items.${kanjiId}.browseCount`]: FieldValue.increment(1),
          lastUpdated: timestamp
        }, { merge: true });
      }

      await batch.commit();

      // Update user's daily activity for streak tracking
      const today = new Date().toISOString().split('T')[0];
      await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('achievements')
        .doc('activities')
        .set({
          [`dates.${today}`]: true,
          lastActivity: timestamp
        }, { merge: true });

      return NextResponse.json({
        success: true,
        message: `Tracked ${kanjiIds.length} kanji browse events`
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[Kanji Browse Track] Error:', error);
    return NextResponse.json(
      { error: 'Failed to track browse event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}