import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb, getAdminDb } from '@/lib/firebase/admin'
import { nanoid } from 'nanoid'
import { Timestamp } from 'firebase-admin/firestore'

// Use centralized getAdminDb() for null-safe database access
const getDb = getAdminDb

// GET /api/blog - Fetch all blog posts (for admin)
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Check if user is admin
    if (!session.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const db = getDb()

    // Get all posts for admin view
    const postsSnapshot = await db
      .collection('blogPosts')
      .orderBy('publishDate', 'desc')
      .get()

    const posts = postsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamps to ISO strings for JSON serialization
        publishDate: data.publishDate instanceof Timestamp ? data.publishDate.toDate().toISOString() : data.publishDate,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      }
    })

    return NextResponse.json({
      success: true,
      data: posts
    })
  } catch (error: any) {
    console.error('Error fetching blog posts:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blog posts' } },
      { status: 500 }
    )
  }
}

// POST /api/blog - Create a new blog post
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Check if user is admin
    if (!session.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Generate ID and prepare data
    const postId = nanoid()
    const now = Timestamp.now()

    // Calculate reading time
    const wordsPerMinute = 200
    const wordCount = body.content?.trim().split(/\s+/).length || 0
    const readingTime = `${Math.ceil(wordCount / wordsPerMinute)} min read`

    // Generate slug if not provided
    const slug = body.slug || body.title?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const db = getDb()

    // Get user info for author details
    const userDoc = await db.collection('users').doc(session.uid).get()
    const userData = userDoc.data()

    // Determine author name - use from body if provided, otherwise use user display name or email
    const authorName = body.author || userData?.displayName || userData?.email || session.email || 'Moshimoshi Team'

    // Build the blog post object, only including defined fields
    const blogPost: any = {
      id: postId,
      title: body.title,
      slug: slug,
      content: body.content,
      excerpt: body.excerpt || '',
      author: authorName,
      authorEmail: session.email,
      tags: body.tags || [],
      status: body.status || 'draft',
      publishDate: body.publishDate ? Timestamp.fromDate(new Date(body.publishDate)) : now,
      createdAt: now,
      updatedAt: now,
      readingTime: readingTime,
      views: 0
    }

    // Add author image from user data if available
    if (userData?.photoURL) {
      blogPost.authorImage = userData.photoURL
    }

    // Only add optional fields if they have values
    if (body.cover) blogPost.cover = body.cover
    if (body.seoTitle) blogPost.seoTitle = body.seoTitle
    if (body.seoDescription) blogPost.seoDescription = body.seoDescription
    if (body.ogImage) blogPost.ogImage = body.ogImage
    if (body.canonical) blogPost.canonical = body.canonical
    if (body.isFeatured !== undefined) blogPost.isFeatured = body.isFeatured

    // Save to Firestore
    await db
      .collection('blogPosts')
      .doc(postId)
      .set(blogPost)

    // Convert Timestamps to ISO strings for response
    const responseData = {
      ...blogPost,
      publishDate: blogPost.publishDate instanceof Timestamp ? blogPost.publishDate.toDate().toISOString() : blogPost.publishDate,
      createdAt: blogPost.createdAt instanceof Timestamp ? blogPost.createdAt.toDate().toISOString() : blogPost.createdAt,
      updatedAt: blogPost.updatedAt instanceof Timestamp ? blogPost.updatedAt.toDate().toISOString() : blogPost.updatedAt,
    }

    return NextResponse.json({
      success: true,
      data: responseData
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating blog post:', error)
    console.error('Error details:', error.stack || error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Return more detailed error in development
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Failed to create blog post: ${error.message}`
      : 'Failed to create blog post'

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}

// PATCH /api/blog - Update a blog post
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Check if user is admin
    if (!session.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Post ID required' } },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get the post to verify it exists
    const postRef = db.collection('blogPosts').doc(id)
    const postDoc = await postRef.get()

    if (!postDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
        { status: 404 }
      )
    }

    // Build clean update object
    const updatedData: any = {
      updatedAt: Timestamp.now()
    }

    // Only include fields that are being updated
    if (updates.title !== undefined) {
      updatedData.title = updates.title
      // Update slug if title changed and no custom slug provided
      if (!updates.slug) {
        updatedData.slug = updates.title.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      }
    }

    if (updates.slug !== undefined) updatedData.slug = updates.slug
    if (updates.content !== undefined) {
      updatedData.content = updates.content
      // Update reading time
      const wordsPerMinute = 200
      const wordCount = updates.content.trim().split(/\s+/).length
      updatedData.readingTime = `${Math.ceil(wordCount / wordsPerMinute)} min read`
    }

    if (updates.excerpt !== undefined) updatedData.excerpt = updates.excerpt
    if (updates.status !== undefined) updatedData.status = updates.status
    if (updates.tags !== undefined) updatedData.tags = updates.tags
    if (updates.author !== undefined) updatedData.author = updates.author

    // Handle publishDate
    if (updates.publishDate !== undefined) {
      updatedData.publishDate = Timestamp.fromDate(new Date(updates.publishDate))
    }

    // Optional fields - only add if provided
    if (updates.authorImage !== undefined) updatedData.authorImage = updates.authorImage
    if (updates.cover !== undefined) updatedData.cover = updates.cover
    if (updates.seoTitle !== undefined) updatedData.seoTitle = updates.seoTitle
    if (updates.seoDescription !== undefined) updatedData.seoDescription = updates.seoDescription
    if (updates.ogImage !== undefined) updatedData.ogImage = updates.ogImage
    if (updates.canonical !== undefined) updatedData.canonical = updates.canonical
    if (updates.isFeatured !== undefined) updatedData.isFeatured = updates.isFeatured

    await postRef.update(updatedData)

    // Get updated post
    const updatedDoc = await postRef.get()
    const data = updatedDoc.data()
    const updatedPost = {
      id: updatedDoc.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings for JSON serialization
      publishDate: data?.publishDate instanceof Timestamp ? data.publishDate.toDate().toISOString() : data?.publishDate,
      createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data?.createdAt,
      updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data?.updatedAt,
    }

    return NextResponse.json({
      success: true,
      data: updatedPost
    })

  } catch (error: any) {
    console.error('Error updating blog post:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update blog post' } },
      { status: 500 }
    )
  }
}

// DELETE /api/blog - Delete a blog post
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()

    // Check if user is admin
    if (!session.admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Post ID required' } },
        { status: 400 }
      )
    }

    const db = getDb()
    const postRef = db.collection('blogPosts').doc(id)

    // Check if post exists
    const postDoc = await postRef.get()
    if (!postDoc.exists) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
        { status: 404 }
      )
    }

    // Delete the post
    await postRef.delete()

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted successfully'
    })

  } catch (error: any) {
    console.error('Error deleting blog post:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete blog post' } },
      { status: 500 }
    )
  }
}