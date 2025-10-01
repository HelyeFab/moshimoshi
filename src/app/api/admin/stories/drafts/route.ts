import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth/session';
import { adminFirestore } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Check admin session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const isAdminUser = await isAdmin();
    if (!isAdminUser) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limitCount = limitParam ? parseInt(limitParam, 10) : 100;

    // Fetch drafts from Firestore using Admin SDK
    const draftsSnapshot = await adminFirestore!
      .collection('ai_story_drafts')
      .orderBy('updatedAt', 'desc')
      .limit(limitCount)
      .get();

    const drafts = draftsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[Admin Drafts API] Error fetching drafts:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch drafts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}