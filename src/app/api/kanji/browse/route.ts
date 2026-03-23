import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

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

    console.warn('[Kanji Browse] GET is no longer supported. Kanji catalog data is loaded client-side via kanjiService.', filters);
    return NextResponse.json(
      {
        error: 'Kanji catalog data is served from local JSON via kanjiService. GET /api/kanji/browse is not supported.',
      },
      { status: 410 }
    );

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
    const db = getDb();

    // Track browse events
    if (action === 'browse') {
      const batch = db.batch();

      for (const kanjiId of kanjiIds) {
        // Add to browse history
        const historyRef = db
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
        const progressRef = db
          .collection('users')
          .doc(session.uid)
          .collection('progress')
          .doc('kanji');

        batch.set(progressRef, {
          userId: session.uid,
          contentType: 'kanji',
          [`items.${kanjiId}.lastBrowsed`]: timestamp,
          [`items.${kanjiId}.browseCount`]: FieldValue.increment(1),
          lastUpdated: timestamp
        }, { merge: true });
      }

      await batch.commit();

      // Update user's daily activity for streak tracking
      const today = new Date().toISOString().split('T')[0];
      await db
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
