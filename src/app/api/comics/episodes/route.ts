import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { evaluate } from '@/lib/entitlements/evaluator'
import type { EvalContext, FeatureId } from '@/types/entitlements'

/**
 * GET /api/comics/episodes
 * List published comic episodes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const seriesId = searchParams.get('seriesId') || 'moshi-goes-to-japan'
    const jlptLevel = searchParams.get('jlptLevel')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const userDoc = await db.collection('users').doc(session.uid).get()
    const plan = userDoc.data()?.subscription?.plan || 'free'
    const evalContext: EvalContext = {
      userId: session.uid,
      plan: plan as any,
      usage: { comics: 0 } as Record<FeatureId, number>,
      nowUtcISO: new Date().toISOString(),
    }
    const decision = evaluate('comics' as FeatureId, evalContext)
    if (!decision.allow) {
      return NextResponse.json({ error: 'Premium required', decision }, { status: 403 })
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

    // Add displayNumber based on position in sorted list (1-indexed)
    // This provides sequential numbers to users even when episodeNumber has gaps
    // EP 1 = first episode created, EP N = latest episode created
    episodes = episodes.map((ep: any, index: number) => ({
      ...ep,
      displayNumber: index + 1,
    }))

    // Reverse order so latest episodes show first (newest at top)
    episodes.reverse()

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
