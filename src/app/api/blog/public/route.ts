import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'

// GET /api/blog/public - Fetch published blog posts (public view)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const maxPosts = limitParam ? parseInt(limitParam, 10) : 100

    // Get published posts only
    const now = Timestamp.now()
    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .where('status', '==', 'published')
      .orderBy('publishDate', 'desc')
      .limit(maxPosts)
      .get()

    const posts = postsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

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