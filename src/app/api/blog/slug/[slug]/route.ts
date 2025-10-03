import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'

// GET /api/blog/slug/[slug] - Get a blog post by slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const session = await getSession()

    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .where('slug', '==', slug)
      .limit(1)
      .get()

    if (postsSnapshot.empty) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
        { status: 404 }
      )
    }

    const postDoc = postsSnapshot.docs[0]
    const data = postDoc.data()
    const post = {
      id: postDoc.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings for JSON serialization
      publishDate: data.publishDate instanceof Timestamp ? data.publishDate.toDate().toISOString() : data.publishDate,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    }

    // Check if user can view this post
    if (post.status !== 'published' && !session?.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    // Increment views for published posts
    if (post.status === 'published') {
      await postDoc.ref.update({
        views: (post.views || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      data: post
    })
  } catch (error: any) {
    console.error('Error fetching blog post by slug:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blog post' } },
      { status: 500 }
    )
  }
}