import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/admin'

/**
 * GET /api/comics/episodes
 * List published comic episodes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const seriesId = searchParams.get('seriesId') || 'moshi-goes-to-japan'
    const jlptLevel = searchParams.get('jlptLevel')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Build query
    let snapshot
    try {
      const query = db
        .collection('comics')
        .where('seriesId', '==', seriesId)
        .where('status', '==', 'published')
        .orderBy('episodeNumber', 'asc')

      snapshot = await query.get()
    } catch (error: any) {
      // Index may still be building
      if (error.code === 9) {
        console.log('📺 Index building, fetching all comics as fallback...')
        snapshot = await db.collection('comics').get()
      } else {
        throw error
      }
    }

    // Convert to array and format dates
    let episodes = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        publishedAt: data.publishedAt?.toDate?.() || data.publishedAt,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      }
    })

    // Filter for published and correct series (fallback case)
    episodes = episodes.filter(
      (ep: any) => ep.status === 'published' && ep.seriesId === seriesId
    )

    // Sort by episode number
    episodes.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber)

    // Apply JLPT filter if specified
    if (jlptLevel && jlptLevel !== 'all') {
      episodes = episodes.filter((ep: any) => ep.jlptLevel === jlptLevel)
    }

    const totalCount = episodes.length
    const hasMore = offset + limit < totalCount

    // Apply pagination
    episodes = episodes.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      episodes,
      totalCount,
      hasMore,
      meta: {
        offset,
        limit,
        seriesId,
      },
    })
  } catch (error) {
    console.error('Error fetching comic episodes:', error)
    return NextResponse.json({
      success: true,
      episodes: [],
      totalCount: 0,
      hasMore: false,
      meta: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
}
