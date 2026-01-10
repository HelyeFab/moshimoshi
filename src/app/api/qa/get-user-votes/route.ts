import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

type VoteType = 'upvote' | 'downvote'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()
    const questionIds = Array.isArray(body?.questionIds) ? body.questionIds : []
    const answerIds = Array.isArray(body?.answerIds) ? body.answerIds : []

    const questionVotes: Record<string, VoteType> = {}
    const answerVotes: Record<string, VoteType> = {}

    const questionPromises = questionIds.map(async (questionId: string) => {
      const voteDocId = `${session.uid}_${questionId}`
      const voteRef = adminDb.collection('qa_question_votes').doc(voteDocId)
      const snapshot = await voteRef.get()
      if (snapshot.exists) {
        questionVotes[questionId] = snapshot.data()?.voteType as VoteType
      }
    })

    const answerPromises = answerIds.map(async (answerId: string) => {
      const voteDocId = `${session.uid}_${answerId}`
      const voteRef = adminDb.collection('qa_answer_votes').doc(voteDocId)
      const snapshot = await voteRef.get()
      if (snapshot.exists) {
        answerVotes[answerId] = snapshot.data()?.voteType as VoteType
      }
    })

    await Promise.all([...questionPromises, ...answerPromises])

    return NextResponse.json({
      success: true,
      questionVotes,
      answerVotes,
    })
  } catch (error) {
    console.error('[API /qa/get-user-votes] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }
}
