import { NextRequest, NextResponse } from 'next/server'
import { adminFirestore } from '@/lib/firebase/admin'
import type { Story } from '@/types/story'

/**
 * GET /api/stories
 * Fetch paginated stories with server-side filtering
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jlptLevel = searchParams.get('jlptLevel') || 'all'
    const theme = searchParams.get('theme') || 'all'
    const sortBy = searchParams.get('sortBy') || 'newest'
    const searchQuery = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '12')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!adminFirestore) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // Build base query
    let query: any = adminFirestore.collection('stories')

    // Apply status filter (always published for public access)
    query = query.where('status', '==', 'published')

    // Apply JLPT level filter
    if (jlptLevel && jlptLevel !== 'all') {
      query = query.where('jlptLevel', '==', jlptLevel)
    }

    // Apply theme filter
    if (theme && theme !== 'all') {
      query = query.where('theme', '==', theme)
    }

    // Apply sort order
    if (sortBy === 'newest') {
      query = query.orderBy('publishedAt', 'desc')
    } else if (sortBy === 'popular') {
      query = query.orderBy('viewCount', 'desc')
    } else {
      // Default to newest
      query = query.orderBy('publishedAt', 'desc')
    }

    // Get total count for pagination metadata
    const countSnapshot = await query.get()
    const totalCount = countSnapshot.size

    // Apply pagination with cursor-based startAfter for efficiency
    let paginatedQuery = query.limit(limit)

    if (offset > 0) {
      // Build cursor query to find the document to start after
      let offsetQuery: any = adminFirestore.collection('stories')
      offsetQuery = offsetQuery.where('status', '==', 'published')

      if (jlptLevel && jlptLevel !== 'all') {
        offsetQuery = offsetQuery.where('jlptLevel', '==', jlptLevel)
      }
      if (theme && theme !== 'all') {
        offsetQuery = offsetQuery.where('theme', '==', theme)
      }

      if (sortBy === 'newest') {
        offsetQuery = offsetQuery.orderBy('publishedAt', 'desc')
      } else if (sortBy === 'popular') {
        offsetQuery = offsetQuery.orderBy('viewCount', 'desc')
      } else {
        offsetQuery = offsetQuery.orderBy('publishedAt', 'desc')
      }

      const offsetSnapshot = await offsetQuery.limit(offset).get()
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1]
        paginatedQuery = paginatedQuery.startAfter(lastDoc)
      }
    }

    // Fetch paginated stories
    const snapshot = await paginatedQuery.get()

    // Convert to array and format dates
    let stories = snapshot.docs.map((doc: any) => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
      }
    })

    // Apply client-side search filter if provided
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      stories = stories.filter((story: any) =>
        story.title?.toLowerCase().includes(searchLower) ||
        story.description?.toLowerCase().includes(searchLower) ||
        story.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
      )
    }

    const hasMore = (offset + limit) < totalCount

    return NextResponse.json({
      success: true,
      stories,
      totalCount,
      hasMore,
      meta: {
        offset,
        limit,
        page: Math.floor(offset / limit),
      },
    })
  } catch (error) {
    console.error('[API] Error fetching stories:', error)
    return NextResponse.json({
      success: false,
      stories: [],
      totalCount: 0,
      hasMore: false,
      meta: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 })
  }
}
