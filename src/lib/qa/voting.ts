/**
 * Voting Service
 * Handle upvotes/downvotes for questions and answers
 *
 * IMPORTANT: Available to ALL logged-in users (free + premium)
 * Users can only vote once per item (question or answer)
 *
 * NOTE: Vote counting is handled server-side by Cloud Functions
 * This service uses API routes with Admin SDK (works for all authenticated users)
 * The server automatically increments/decrements counts on questions/answers via Cloud Functions
 */

// Note: Firestore client SDK imports removed - now using API routes with Admin SDK
// This allows voting to work for all users (free + premium) regardless of Firebase Auth state

const QUESTION_VOTES_COLLECTION = 'qa_question_votes'
const ANSWER_VOTES_COLLECTION = 'qa_answer_votes'

export type VoteType = 'upvote' | 'downvote'

/**
 * Vote on a question
 * Logged-in users only (free + premium equal access)
 * Uses server-side API route with Admin SDK (works for all users)
 */
export async function voteQuestion(
  questionId: string,
  userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    console.log('[voteQuestion] Calling API:', { questionId, userId, voteType })

    // Call server-side API route
    const response = await fetch('/api/qa/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session cookie
      body: JSON.stringify({
        itemId: questionId,
        itemType: 'question',
        voteType,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[voteQuestion] API error:', errorData)
      return { success: false }
    }

    const result = await response.json()
    console.log('[voteQuestion] API success:', result)

    return {
      success: true,
      currentVote: result.currentVote,
    }
  } catch (error) {
    console.error('Failed to vote on question:', error)
    return { success: false }
  }
}

/**
 * Vote on an answer
 * Logged-in users only (free + premium equal access)
 * Uses server-side API route with Admin SDK (works for all users)
 */
export async function voteAnswer(
  answerId: string,
  userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    console.log('[voteAnswer] Calling API:', { answerId, userId, voteType })

    // Call server-side API route
    const response = await fetch('/api/qa/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include session cookie
      body: JSON.stringify({
        itemId: answerId,
        itemType: 'answer',
        voteType,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('[voteAnswer] API error:', errorData)
      return { success: false }
    }

    const result = await response.json()
    console.log('[voteAnswer] API success:', result)

    return {
      success: true,
      currentVote: result.currentVote,
    }
  } catch (error) {
    console.error('Failed to vote on answer:', error)
    return { success: false }
  }
}

/**
 * Get user's existing vote on a question
 * Uses API route with Admin SDK to work for all users (free + premium)
 */
async function getUserQuestionVote(
  questionId: string,
  userId: string
): Promise<VoteType | null> {
  try {
    const response = await fetch(`/api/qa/get-user-votes?questionIds=${questionId}`, {
      method: 'GET',
      credentials: 'include', // Include session cookie
    })

    if (!response.ok) {
      console.error('Failed to fetch user question vote:', response.statusText)
      return null
    }

    const data = await response.json()
    return data.questionVotes[questionId] || null
  } catch (error) {
    console.error('Failed to get user question vote:', error)
    return null
  }
}

/**
 * Get user's existing vote on an answer
 * Uses API route with Admin SDK to work for all users (free + premium)
 */
async function getUserAnswerVote(answerId: string, userId: string): Promise<VoteType | null> {
  try {
    const response = await fetch(`/api/qa/get-user-votes?answerIds=${answerId}`, {
      method: 'GET',
      credentials: 'include', // Include session cookie
    })

    if (!response.ok) {
      console.error('Failed to fetch user answer vote:', response.statusText)
      return null
    }

    const data = await response.json()
    return data.answerVotes[answerId] || null
  } catch (error) {
    console.error('Failed to get user answer vote:', error)
    return null
  }
}

/**
 * Get all user votes for questions (for batch loading)
 * Uses API route with Admin SDK to work for all users (free + premium)
 */
export async function getUserQuestionVotes(
  questionIds: string[],
  userId: string
): Promise<Map<string, VoteType>> {
  try {
    if (questionIds.length === 0) return new Map()

    const response = await fetch(`/api/qa/get-user-votes?questionIds=${questionIds.join(',')}`, {
      method: 'GET',
      credentials: 'include', // Include session cookie
    })

    if (!response.ok) {
      console.error('Failed to fetch user question votes:', response.statusText)
      return new Map()
    }

    const data = await response.json()
    const votes = new Map<string, VoteType>()

    Object.entries(data.questionVotes).forEach(([questionId, voteType]) => {
      votes.set(questionId, voteType as VoteType)
    })

    return votes
  } catch (error) {
    console.error('Failed to get user question votes:', error)
    return new Map()
  }
}

/**
 * Get all user votes for answers (for batch loading)
 * Uses API route with Admin SDK to work for all users (free + premium)
 */
export async function getUserAnswerVotes(
  answerIds: string[],
  userId: string
): Promise<Map<string, VoteType>> {
  try {
    if (answerIds.length === 0) return new Map()

    const response = await fetch(`/api/qa/get-user-votes?answerIds=${answerIds.join(',')}`, {
      method: 'GET',
      credentials: 'include', // Include session cookie
    })

    if (!response.ok) {
      console.error('Failed to fetch user answer votes:', response.statusText)
      return new Map()
    }

    const data = await response.json()
    const votes = new Map<string, VoteType>()

    Object.entries(data.answerVotes).forEach(([answerId, voteType]) => {
      votes.set(answerId, voteType as VoteType)
    })

    return votes
  } catch (error) {
    console.error('Failed to get user answer votes:', error)
    return new Map()
  }
}

// Export getter functions for use in components
export { getUserQuestionVote, getUserAnswerVote }
