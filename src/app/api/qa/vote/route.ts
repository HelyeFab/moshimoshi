import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

type VoteType = 'upvote' | 'downvote'
type ItemType = 'question' | 'answer'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.tier === 'guest') {
      return NextResponse.json({ error: 'Guests cannot vote' }, { status: 403 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const body = await request.json()
    const { itemId, itemType, voteType } = body as {
      itemId?: string
      itemType?: ItemType
      voteType?: VoteType
    }

    if (!itemId || (itemType !== 'question' && itemType !== 'answer')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (voteType !== 'upvote' && voteType !== 'downvote') {
      return NextResponse.json({ error: 'Invalid vote type' }, { status: 400 })
    }

    const votesCollection =
      itemType === 'question' ? 'qa_question_votes' : 'qa_answer_votes'
    const itemsCollection = itemType === 'question' ? 'qa_questions' : 'qa_answers'
    const voteDocId = `${session.uid}_${itemId}`
    const voteRef = adminDb.collection(votesCollection).doc(voteDocId)
    const itemRef = adminDb.collection(itemsCollection).doc(itemId)

    const result = await adminDb.runTransaction(async (transaction) => {
      const [itemSnap, voteSnap] = await Promise.all([
        transaction.get(itemRef),
        transaction.get(voteRef),
      ])

      if (!itemSnap.exists) {
        throw new Error('Item not found')
      }

      const existingVote = voteSnap.exists
        ? (voteSnap.data()?.voteType as VoteType)
        : null

      let newVote: VoteType | undefined
      let upvoteDelta = 0
      let downvoteDelta = 0

      if (existingVote === voteType) {
        transaction.delete(voteRef)
        newVote = undefined
        if (voteType === 'upvote') upvoteDelta = -1
        if (voteType === 'downvote') downvoteDelta = -1
      } else {
        if (existingVote) {
          transaction.delete(voteRef)
        }

        const voteData: Record<string, unknown> = {
          userId: session.uid,
          voteType,
          createdAt: FieldValue.serverTimestamp(),
        }

        if (itemType === 'question') {
          voteData.questionId = itemId
        } else {
          voteData.answerId = itemId
        }

        transaction.set(voteRef, voteData)
        newVote = voteType

        if (existingVote === 'upvote') upvoteDelta = -1
        if (existingVote === 'downvote') downvoteDelta = -1
        if (voteType === 'upvote') upvoteDelta += 1
        if (voteType === 'downvote') downvoteDelta += 1
      }

      return { currentVote: newVote }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    if (error?.message === 'Item not found') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('[API /qa/vote] Error:', error)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
