import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'

interface BlogPostData {
  status: 'draft' | 'published' | 'scheduled'
  publishDate: string | Timestamp
  createdAt?: string | Timestamp
  updatedAt?: string | Timestamp
  [key: string]: unknown
}

// GET /api/blog/public - Fetch published blog posts (public view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const pageParam = searchParams.get('page')

    const limit = limitParam ? parseInt(limitParam, 10) : 12 // Default 12 posts per page
    const page = pageParam ? parseInt(pageParam, 10) : 1
    const offset = (page - 1) * limit

    // Get all posts and filter client-side (avoids compound index requirement)
    const now = Timestamp.now()

    if (!adminDb) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Database not available' } },
        { status: 500 }
      )
    }

    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .get()

    // Filter for published posts and scheduled posts that have reached their publish date
    const allPublishedPosts = postsSnapshot.docs
      .map(doc => {
        const data = doc.data() as BlogPostData
        return {
          id: doc.id,
          ...data,
          // Convert Firestore Timestamps to ISO strings for JSON serialization
          publishDate: data.publishDate instanceof Timestamp ? data.publishDate.toDate().toISOString() : data.publishDate,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
        }
      })
      .filter(post => {
        // Show published posts
        if (post.status === 'published') return true

        // Show scheduled posts that have reached their publish date
        if (post.status === 'scheduled') {
          const publishDate = new Date(post.publishDate)
          const nowDate = now.toDate()
          return publishDate <= nowDate
        }

        // Hide drafts
        return false
      })
      .sort((a, b) => {
        const dateA = new Date(a.publishDate).getTime()
        const dateB = new Date(b.publishDate).getTime()
        return dateB - dateA
      })

    const totalPosts = allPublishedPosts.length
    const totalPages = Math.ceil(totalPosts / limit)
    const posts = allPublishedPosts.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: posts,
      pagination: {
        page,
        limit,
        totalPosts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })
  } catch (error: any) {
    console.error('Error fetching public blog posts:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blog posts' } },
      { status: 500 }
    )
  }
}