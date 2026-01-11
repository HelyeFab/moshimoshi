import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { evaluate } from '@/lib/entitlements/evaluator'
import type { EvalContext, FeatureId } from '@/types/entitlements'

/**
 * GET /api/comics/series
 * Get comic series info (default: moshi-goes-to-japan)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const seriesId = searchParams.get('id') || 'moshi-goes-to-japan'

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

    const seriesDoc = await db.collection('comic_series').doc(seriesId).get()

    if (!seriesDoc.exists) {
      // Return default series info if not yet created
      return NextResponse.json({
        success: true,
        series: {
          id: 'moshi-goes-to-japan',
          slug: 'moshi-goes-to-japan',
          title: 'Moshi Goes to Japan',
          titleJa: 'もしの日本旅行',
          description: 'Follow Moshi the red panda on adventures across Japan while learning Japanese!',
          descriptionJa: 'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！',
          mainCharacterId: 'moshi-master',
          defaultJlptLevel: 'N5',
          episodeCount: 0,
          publishedEpisodeCount: 0,
          isActive: true,
        },
      })
    }

    const data = seriesDoc.data()

    return NextResponse.json({
      success: true,
      series: {
        id: seriesDoc.id,
        ...data,
        createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error fetching comic series:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch series',
      },
      { status: 500 }
    )
  }
}
