import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/kanji/progress
 * Get user's kanji progress for visual indicators
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's progress from Firestore
    const progressDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('progress')
      .doc('kanji')
      .get();

    const progress = progressDoc.data()?.items || {};

    return NextResponse.json({
      progress
    });

  } catch (error) {
    console.error('[Kanji Progress] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch kanji progress', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
