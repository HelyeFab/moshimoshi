import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/admin'

/**
 * GET /api/comics/episodes/[episodeId]
 * Get a single comic episode by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    const { episodeId } = await params

    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const episodeDoc = await db.collection('comics').doc(episodeId).get()

    if (!episodeDoc.exists) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const data = episodeDoc.data()

    // Increment view count
    await episodeDoc.ref.update({
      viewCount: (data?.viewCount || 0) + 1,
    })

    return NextResponse.json({
      success: true,
      episode: {
        id: episodeDoc.id,
        ...data,
        publishedAt: data?.publishedAt?.toDate?.() || data?.publishedAt,
        createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching comic episode:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch episode',
      },
      { status: 500 }
    )
  }
}
