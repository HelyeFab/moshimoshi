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
