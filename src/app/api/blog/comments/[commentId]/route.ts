import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { adminDb, getAdminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import DOMPurify from 'isomorphic-dompurify';

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb;

// PATCH /api/blog/comments/[commentId] - Update a comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    // Require authentication
    const session = await requireAuth();

    const { commentId } = await params;
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

    const db = getDb();

    // Get comment
    const commentRef = db.collection('blogComments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    const commentData = commentDoc.data();

    // Check if user owns this comment
    if (commentData?.userId !== session.uid) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You can only edit your own comments' } },
        { status: 403 }
      );
    }

    // Check if comment is deleted
    if (commentData?.deletedAt) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Cannot edit deleted comments' } },
        { status: 403 }
      );
    }

    // Sanitize content
    const sanitizedContent = DOMPurify.sanitize(trimmedContent, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });

    // Update comment
    const now = Timestamp.now();
    await commentRef.update({
      content: sanitizedContent,
      updatedAt: now,
      isEdited: true,
    });

    // Get updated comment
    const updatedDoc = await commentRef.get();
    const data = updatedDoc.data();

    const responseComment = {
      id: updatedDoc.id,
      ...data,
      createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data?.createdAt,
      updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data?.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: responseComment,
    });

  } catch (error: any) {
    console.error('Error updating comment:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update comment' } },
      { status: 500 }
    );
  }
}

// DELETE /api/blog/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    // Require authentication
    const session = await requireAuth();

    const { commentId } = await params;
    const db = getDb();

    // Get comment
    const commentRef = db.collection('blogComments').doc(commentId);
    const commentDoc = await commentRef.get();

    if (!commentDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Comment not found' } },
        { status: 404 }
      );
    }

    const commentData = commentDoc.data();

    // Check if user owns this comment or is admin
    const isOwner = commentData?.userId === session.uid;
    const isAdmin = session.admin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You can only delete your own comments' } },
        { status: 403 }
      );
    }

    // Soft delete - set deletedAt timestamp
    await commentRef.update({
      deletedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });

  } catch (error: any) {
    console.error('Error deleting comment:', error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comment' } },
      { status: 500 }
    );
  }
}
