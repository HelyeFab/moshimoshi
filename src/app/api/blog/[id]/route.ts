import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

// GET /api/blog/[id] - Get a single blog post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession() // Don't require auth - public can read published posts

    const postRef = adminDb.collection('blogPosts').doc(id)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
        { status: 404 }
      )
    }

    const post = {
      id: postDoc.id,
      ...postDoc.data()
    }

    // Check if user can view this post
    // Admins can see all posts, others can only see published posts
    if (post.status !== 'published' && !session?.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      )
    }

    // Increment views for published posts
    if (post.status === 'published') {
      await postRef.update({
        views: (post.views || 0) + 1
      })
    }

    return NextResponse.json({
      success: true,
      data: post
    })
  } catch (error: any) {
    console.error('Error fetching blog post:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blog post' } },
      { status: 500 }
    )
  }
}