import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

/**
 * DELETE /api/qa/delete-question
 * Server-side question deletion (bypasses Firestore security rules)
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('[API /qa/delete-question] Request received')

    // Verify authentication using session helper
    const session = await getSession()
    console.log('[API /qa/delete-question] Session:', session ? 'valid' : 'invalid')

    if (!session || !session.uid) {
      console.log('[API /qa/delete-question] No valid session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.uid
    const { questionId } = await request.json()

    console.log('[API /qa/delete-question] Authenticated user:', userId)

    console.log('[API /qa/delete-question] Deleting question', { questionId, userId })

    // Get question
    const questionRef = adminDb.collection('qa_questions').doc(questionId)
    const questionDoc = await questionRef.get()

    if (!questionDoc.exists) {
      console.log('[API /qa/delete-question] Question not found')
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const question = questionDoc.data()

    // Verify ownership
    if (question?.author?.uid !== userId) {
      console.log('[API /qa/delete-question] Not the author')
      return NextResponse.json({ error: 'Unauthorized - not the author' }, { status: 403 })
    }

    // Check for approved answers from other users
    const answersSnapshot = await adminDb.collection('qa_answers')
      .where('questionId', '==', questionId)
      .get()

    const approvedAnswersFromOthers = answersSnapshot.docs.filter(doc => {
      const answer = doc.data()
      return answer.moderationStatus === 'approved' && answer.author?.uid !== userId
    })

    if (approvedAnswersFromOthers.length > 0) {
      console.log('[API /qa/delete-question] Has approved answers from others')
      return NextResponse.json({
        error: 'Cannot delete question with approved answers from other users',
        code: 'HAS_APPROVED_ANSWERS'
      }, { status: 400 })
    }

    console.log('[API /qa/delete-question] Starting deletion...', { answerCount: answersSnapshot.size })

    // Delete answer votes and answers using Admin SDK (bypasses security rules)
    const batch = adminDb.batch()
    let batchOps = 0

    for (const answerDoc of answersSnapshot.docs) {
      const answerVotesSnapshot = await adminDb.collection('qa_answer_votes')
        .where('answerId', '==', answerDoc.id)
        .get()

      // Delete answer votes
      for (const voteDoc of answerVotesSnapshot.docs) {
        batch.delete(voteDoc.ref)
        batchOps++
      }

      // Delete answer
      batch.delete(answerDoc.ref)
      batchOps++

      // Commit in batches of 450
      if (batchOps >= 450) {
        await batch.commit()
        batchOps = 0
      }
    }

    // Delete question votes
    const questionVotesSnapshot = await adminDb.collection('qa_question_votes')
      .where('questionId', '==', questionId)
      .get()

    for (const voteDoc of questionVotesSnapshot.docs) {
      batch.delete(voteDoc.ref)
      batchOps++
    }

    // Delete question
    batch.delete(questionRef)
    batchOps++

    // Commit final batch
    if (batchOps > 0) {
      await batch.commit()
    }

    console.log('[API /qa/delete-question] ✅ Success')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API /qa/delete-question] Error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to delete question'
    }, { status: 500 })
  }
}
