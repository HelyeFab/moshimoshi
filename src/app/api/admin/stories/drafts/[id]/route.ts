import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth/session';
import { adminFirestore } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const draftId = params.id;

    // Fetch draft from Firestore using Admin SDK
    const draftDoc = await adminFirestore!
      .collection('ai_story_drafts')
      .doc(draftId)
      .get();

    if (!draftDoc.exists) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const data = draftDoc.data();
    const draft = {
      id: draftDoc.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[Admin Draft API] Error fetching draft:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch draft',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}