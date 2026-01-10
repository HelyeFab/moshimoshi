import { NextRequest, NextResponse } from 'next/server'
import { adminDb, FieldValue } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

/**
 * POST /api/qa/vote
 *
 * Server-side voting endpoint for Tea House Q&A
 * Uses Admin SDK to work for ALL authenticated users (free + premium)
 *
 * Request Body:
 * {
 *   itemId: string,           // Question or answer ID
 *   itemType: 'question' | 'answer',
 *   voteType: 'upvote' | 'downvote'
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   currentVote?: 'upvote' | 'downvote' | undefined
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[API /qa/vote] Request received')

    // 1. Verify authentication using session helper (works for free users with JWT cookies)
    const session = await getSession()

    if (!session || !session.uid) {
      console.log('[API /qa/vote] No valid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.uid
    console.log('[API /qa/vote] Authenticated user:', userId)

    // 2. Parse request body
    const body = await request.json()
    const { itemId, itemType, voteType } = body

    console.log('[API /qa/vote] Vote request:', { itemId, itemType, voteType })

    // 3. Validate input
    if (!itemId || !itemType || !voteType) {
      return NextResponse.json(
        { error: 'Missing required fields: itemId, itemType, voteType' },
        { status: 400 }
      )
    }

    if (!['question', 'answer'].includes(itemType)) {
      return NextResponse.json(
        { error: 'Invalid itemType. Must be "question" or "answer"' },
        { status: 400 }
      )
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json(
        { error: 'Invalid voteType. Must be "upvote" or "downvote"' },
        { status: 400 }
      )
    }

    if (!adminDb) {
      console.error('[API /qa/vote] Admin DB not initialized')
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    // 4. Set up collection references based on item type
    const voteCollection = itemType === 'question' ? 'qa_question_votes' : 'qa_answer_votes'
    const itemCollection = itemType === 'question' ? 'qa_questions' : 'qa_answers'

    // 5. Use deterministic document ID (same as client-side pattern)
    const voteDocId = `${userId}_${itemId}`
    const voteRef = adminDb.collection(voteCollection).doc(voteDocId)
    const itemRef = adminDb.collection(itemCollection).doc(itemId)

    console.log('[API /qa/vote] Starting transaction for vote:', voteDocId)

    // 6. Run Admin SDK transaction (IDENTICAL logic to client-side)
    const result = await adminDb.runTransaction(async (transaction) => {
      // Read existing vote document
      const voteSnap = await transaction.get(voteRef)
      const existingVote = voteSnap.exists ? (voteSnap.data()?.voteType as 'upvote' | 'downvote') : null

      console.log('[API /qa/vote] Existing vote:', existingVote)

      // Read item to verify it exists and get author
      const itemSnap = await transaction.get(itemRef)

      if (!itemSnap.exists()) {
        throw new Error(`${itemType} not found`)
      }

      const itemData = itemSnap.data()

      // 7. Prevent self-voting (server-side validation)
      if (itemData?.author?.uid === userId) {
        throw new Error('Cannot vote on your own content')
      }

      // 8. Determine action based on existing vote
      let newVote: 'upvote' | 'downvote' | undefined = undefined

      if (existingVote === voteType) {
        // Toggle off - remove vote
        console.log('[API /qa/vote] Toggling off existing vote')
        transaction.delete(voteRef)
        newVote = undefined
      } else if (existingVote) {
        // Change vote type
        console.log('[API /qa/vote] Changing vote type from', existingVote, 'to', voteType)
        transaction.set(voteRef, {
          [itemType === 'question' ? 'questionId' : 'answerId']: itemId,
          userId,
          voteType,
          createdAt: FieldValue.serverTimestamp(),
        })
        newVote = voteType
      } else {
        // New vote
        console.log('[API /qa/vote] Creating new vote')
        transaction.set(voteRef, {
          [itemType === 'question' ? 'questionId' : 'answerId']: itemId,
          userId,
          voteType,
          createdAt: FieldValue.serverTimestamp(),
        })
        newVote = voteType
      }

      return { currentVote: newVote }
    })

    console.log('[API /qa/vote] Transaction successful, result:', result)

    // 9. Return success response
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('[API /qa/vote] Error:', error)

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message?.includes('Cannot vote on your own')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    // Generic error
    return NextResponse.json(
      {
        error: error.message || 'Failed to vote',
      },
      { status: 500 }
    )
  }
}
