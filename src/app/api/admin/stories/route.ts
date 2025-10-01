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

    // Fetch stories from Firestore using Admin SDK
    const storiesSnapshot = await adminFirestore!
      .collection('stories')
      .orderBy('updatedAt', 'desc')
      .limit(limitCount)
      .get();

    const stories = storiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('[Admin Stories API] Error fetching stories:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch stories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const { storyId } = await request.json();

    if (!storyId) {
      return NextResponse.json(
        { error: 'Story ID is required' },
        { status: 400 }
      );
    }

    // Try to delete from both collections
    // First check if it's a published story
    const storyDoc = await adminFirestore!
      .collection('stories')
      .doc(storyId)
      .get();

    if (storyDoc.exists) {
      // Delete from stories collection
      await adminFirestore!
        .collection('stories')
        .doc(storyId)
        .delete();
    } else {
      // Try deleting from drafts collection
      const draftDoc = await adminFirestore!
        .collection('ai_story_drafts')
        .doc(storyId)
        .get();

      if (draftDoc.exists) {
        await adminFirestore!
          .collection('ai_story_drafts')
          .doc(storyId)
          .delete();
      } else {
        return NextResponse.json(
          { error: 'Story not found in either collection' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Stories API] Error deleting story:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete story',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}