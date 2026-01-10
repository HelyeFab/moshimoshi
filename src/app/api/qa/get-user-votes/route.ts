import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

/**
 * GET /api/qa/get-user-votes
 *
 * Fetches user's votes for questions and/or answers
 * Uses Admin SDK to bypass Firestore security rules
 *
 * Query params:
 * - questionIds: comma-separated list of question IDs
 * - answerIds: comma-separated list of answer IDs
 *
 * Returns: { questionVotes: {}, answerVotes: {} }
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API /qa/get-user-votes] Request received')

    // Verify authentication using session helper
    const session = await getSession()
    console.log('[API /qa/get-user-votes] Session:', session ? `valid (uid: ${session.uid})` : 'null/invalid')

    if (!session || !session.uid) {
      console.log('[API /qa/get-user-votes] No valid session, returning 401')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.uid
    console.log('[API /qa/get-user-votes] Authenticated user:', userId)
    const { searchParams } = new URL(request.url)

    const questionIdsParam = searchParams.get('questionIds')
    const answerIdsParam = searchParams.get('answerIds')

    if (!adminDb) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const result: {
      questionVotes: Record<string, 'upvote' | 'downvote'>
      answerVotes: Record<string, 'upvote' | 'downvote'>
    } = {
      questionVotes: {},
      answerVotes: {}
    }

    // Fetch question votes
    if (questionIdsParam) {
      const questionIds = questionIdsParam.split(',').filter(Boolean)

      for (const questionId of questionIds) {
        // Use deterministic document ID to match client-side logic
        const voteDocId = `${userId}_${questionId}`
        const voteRef = adminDb.collection('qa_question_votes').doc(voteDocId)
        const voteSnap = await voteRef.get()

        if (voteSnap.exists) {
          const voteData = voteSnap.data()
          result.questionVotes[questionId] = voteData?.voteType as 'upvote' | 'downvote'
        }
      }
    }

    // Fetch answer votes
    if (answerIdsParam) {
      const answerIds = answerIdsParam.split(',').filter(Boolean)

      for (const answerId of answerIds) {
        // Use deterministic document ID to match client-side logic
        const voteDocId = `${userId}_${answerId}`
        const voteRef = adminDb.collection('qa_answer_votes').doc(voteDocId)
        const voteSnap = await voteRef.get()

        if (voteSnap.exists) {
          const voteData = voteSnap.data()
          result.answerVotes[answerId] = voteData?.voteType as 'upvote' | 'downvote'
        }
      }
    }

    console.log('[API /qa/get-user-votes] ✅ Success, returning votes')
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[API /qa/get-user-votes] ❌ Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to fetch votes'
    }, { status: 500 })
  }
}
