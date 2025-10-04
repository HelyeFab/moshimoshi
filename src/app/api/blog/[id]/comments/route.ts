import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { nanoid } from 'nanoid';
import { Timestamp } from 'firebase-admin/firestore';
import DOMPurify from 'isomorphic-dompurify';

// GET /api/blog/[id]/comments - Get all comments for a blog post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const postId = params.id;

    // Get all comments for this post and filter/sort client-side to avoid index requirement
    const commentsSnapshot = await adminDb
      .collection('blogComments')
      .where('postId', '==', postId)
      .get();

    const comments = commentsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        };
      })
      .filter((comment) => !comment.deletedAt) // Filter out deleted comments
      .sort((a, b) => {
        // Sort by createdAt descending
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch comments' } },
      { status: 500 }
    );
  }
}

// POST /api/blog/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const session = await requireAuth();

    const postId = params.id;
    const body = await request.json();

    // Validate content
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_CONTENT', message: 'Comment content is required' } },
        { status: 400 }
      );
    }

    const trimmedContent = body.content.trim();

    if (trimmedContent.length < 2) {
      return NextResponse.json(
        { error: { code: 'INVALID_CONTENT', message: 'Comment must be at least 2 characters' } },
        { status: 400 }
      );
    }

    if (trimmedContent.length > 2000) {
      return NextResponse.json(
        { error: { code: 'INVALID_CONTENT', message: 'Comment must be less than 2000 characters' } },
        { status: 400 }
      );
    }

    // Sanitize content to prevent XSS
    const sanitizedContent = DOMPurify.sanitize(trimmedContent, {
      ALLOWED_TAGS: [], // Strip all HTML tags
      ALLOWED_ATTR: [],
    });

    // Verify blog post exists
    const postDoc = await adminDb.collection('blogPosts').doc(postId).get();
    if (!postDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
        { status: 404 }
      );
    }

    // Get user data for display
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    const userData = userDoc.data();

    // Create comment
    const commentId = nanoid();
    const now = Timestamp.now();

    const comment = {
      id: commentId,
      postId: postId,
      userId: session.uid,
      userDisplayName: userData?.displayName || session.email || 'Anonymous',
      userPhotoURL: userData?.photoURL || null,
      userEmail: session.email,
      content: sanitizedContent,
      createdAt: now,
      updatedAt: now,
      isEdited: false,
      deletedAt: null,
    };

    await adminDb.collection('blogComments').doc(commentId).set(comment);

    // Return comment with ISO dates
    const responseComment = {
      ...comment,
      createdAt: now.toDate().toISOString(),
      updatedAt: now.toDate().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseComment,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating comment:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'You must be logged in to comment' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create comment' } },
      { status: 500 }
    );
  }
}
