import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'

// GET /api/blog/public - Fetch published blog posts (public view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const maxPosts = limitParam ? parseInt(limitParam, 10) : 100

    // Get all posts and filter client-side (avoids compound index requirement)
    const now = Timestamp.now()
    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .get()

    // Filter for published posts and sort client-side
    const posts = postsSnapshot.docs
      .map(doc => {
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
      .filter(post => post.status === 'published')
      .sort((a, b) => {
        const dateA = new Date(a.publishDate).getTime()
        const dateB = new Date(b.publishDate).getTime()
        return dateB - dateA
      })
      .slice(0, maxPosts)

    return NextResponse.json({
      success: true,
      data: posts
    })
  } catch (error: any) {
    console.error('Error fetching public blog posts:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch blog posts' } },
      { status: 500 }
    )
  }
}