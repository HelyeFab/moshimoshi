import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'

// GET /api/blog/debug - Debug endpoint to see ALL blog posts
export async function GET(request: NextRequest) {
  try {
    const postsSnapshot = await adminDb
      .collection('blogPosts')
      .get()

    const posts = postsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title,
        slug: data.slug,
        status: data.status,
        author: data.author,
        publishDate: data.publishDate instanceof Timestamp
          ? data.publishDate.toDate().toISOString()
          : data.publishDate,
        createdAt: data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      count: posts.length,
      data: posts
    })
  } catch (error: any) {
    console.error('Error fetching blog posts:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
