import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth/session';
import { initAdmin } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initAdmin();
const db = getFirestore();

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
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
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { draftId } = await request.json();

    if (!draftId) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    // Get the draft from Firestore
    const draftDoc = await db.collection('ai_story_drafts').doc(draftId).get();
    if (!draftDoc.exists) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const draft = draftDoc.data();

    // Create slug from title
    const baseSlug = (draft?.characterSheet?.storyTitle || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    const slug = `${baseSlug}-${Date.now()}`;

    // Convert draft to story format
    const story = {
      title: draft?.characterSheet?.storyTitle || 'Untitled Story',
      titleJa: draft?.characterSheet?.storyTitleJa || '無題',
      description: draft?.characterSheet?.summary || '',
      theme: draft?.theme || 'adventure',
      jlptLevel: draft?.jlptLevel || 'N5',
      pages: draft?.pages || [],
      quiz: draft?.quiz || [],
      authorId: session.uid,
      status: 'published',
      viewCount: 0,
      completionCount: 0,
      slug,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: new Date(),
      characterSheet: draft?.characterSheet,
      modelSheet: draft?.modelSheet
    };

    // Save to stories collection
    await db.collection('stories').doc(slug).set(story);

    return NextResponse.json({
      success: true,
      storyId: slug,
      story
    });

  } catch (error) {
    console.error('Error publishing draft:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to publish draft',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}