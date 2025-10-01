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

    // Get all drafts from ai_story_drafts collection
    const draftsSnapshot = await db.collection('ai_story_drafts').get();

    const results = [];
    const errors = [];

    for (const draftDoc of draftsSnapshot.docs) {
      try {
        const draft = draftDoc.data();
        const draftId = draftDoc.id;

        // Skip if already published or incomplete
        if (!draft?.characterSheet || !draft?.pages || draft.pages.length === 0) {
          console.log(`Skipping incomplete draft: ${draftId}`);
          continue;
        }

        // Check if already published (by checking if story with this draft exists)
        const existingStory = await db.collection('stories')
          .where('draftId', '==', draftId)
          .limit(1)
          .get();

        if (!existingStory.empty) {
          console.log(`Draft ${draftId} already published`);
          continue;
        }

        // Create slug from title
        const baseSlug = (draft.characterSheet?.storyTitle || 'untitled')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        const slug = `${baseSlug}-${Date.now()}`;

        // Convert draft to story format
        const story = {
          title: draft.characterSheet?.storyTitle || 'Untitled Story',
          titleJa: draft.characterSheet?.storyTitleJa || '無題',
          description: draft.characterSheet?.summary || '',
          theme: draft.theme || 'adventure',
          jlptLevel: draft.jlptLevel || 'N5',
          pages: draft.pages || [],
          quiz: draft.quiz || [],
          authorId: draft.userId || session.uid,
          status: 'published',
          viewCount: 0,
          completionCount: 0,
          slug,
          draftId, // Keep reference to draft
          createdAt: draft.createdAt || new Date(),
          updatedAt: new Date(),
          publishedAt: new Date(),
          characterSheet: draft.characterSheet,
          modelSheet: draft.modelSheet
        };

        // Save to stories collection
        await db.collection('stories').doc(slug).set(story);

        results.push({
          draftId,
          storyId: slug,
          title: story.title
        });

        console.log(`✅ Published draft ${draftId} as ${slug}`);

      } catch (error) {
        console.error(`Error publishing draft ${draftDoc.id}:`, error);
        errors.push({
          draftId: draftDoc.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      published: results.length,
      errors: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('Error publishing drafts:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to publish drafts',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }, { status: 500 });
  }
}