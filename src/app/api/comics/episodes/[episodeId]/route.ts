import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { evaluate } from '@/lib/entitlements/evaluator'
import type { EvalContext, FeatureId } from '@/types/entitlements'
import { trackUserActivity } from '@/lib/admin/trackActivity'

/**
 * GET /api/comics/episodes/[episodeId]
 * Get a single comic episode by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Track user activity (non-blocking)
    trackUserActivity(session.uid).catch(console.error)

    const { episodeId } = await params

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

    const episodeDoc = await db.collection('comics').doc(episodeId).get()

    if (!episodeDoc.exists) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const data = episodeDoc.data()

    // Calculate displayNumber by finding position among all published episodes
    let displayNumber = data?.episodeNumber || 1
    try {
      const seriesId = data?.seriesId || 'moshi-goes-to-japan'
      const allEpisodesSnapshot = await db
        .collection('comics')
        .where('seriesId', '==', seriesId)
        .where('status', '==', 'published')
        .orderBy('episodeNumber', 'asc')
        .get()

      const position = allEpisodesSnapshot.docs.findIndex(doc => doc.id === episodeId)
      if (position !== -1) {
        displayNumber = position + 1
      }
    } catch (error) {
      // Fallback: use episodeNumber if query fails (e.g., index building)
      console.log('Could not calculate displayNumber, using episodeNumber as fallback')
    }

    // Note: viewCount is now tracked separately via /api/track-view
    // This allows proper tracking whether content is served from cache or network

    // Transform quiz data to match BaseQuizQuestion interface
    // Comic quizzes use questionEn/questionJa, but BaseQuizQuestion expects question/questionJa
    let transformedQuiz = data?.quiz
    if (data?.quiz?.questions) {
      transformedQuiz = {
        ...data.quiz,
        questions: data.quiz.questions.map((q: any) => ({
          ...q,
          // Map questionEn to question (required field in BaseQuizQuestion)
          question: q.questionEn || q.question,
          // Keep questionJa as-is
          // Remove questionEn to avoid confusion
          questionEn: undefined,
        })),
      }
    }

    return NextResponse.json({
      success: true,
      episode: {
        id: episodeDoc.id,
        ...data,
        displayNumber,
        quiz: transformedQuiz,
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
