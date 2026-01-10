/**
 * Voting Service
 * Handle upvotes/downvotes for questions and answers
 *
 * IMPORTANT: Available to ALL logged-in users (free + premium)
 * Users can only vote once per item (question or answer)
 *
 * NOTE: Vote counting is handled server-side by Cloud Functions
 * This service only manages vote documents (create/delete)
 * The server automatically increments/decrements counts on questions/answers
 */

type VoteApiResponse = { success: boolean; currentVote?: VoteType }

export type VoteType = 'upvote' | 'downvote'

/**
 * Vote on a question
 * Logged-in users only (free + premium equal access)
 * Uses Firestore transactions to prevent race conditions and double counting
 */
export async function voteQuestion(
  questionId: string,
  _userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    const response = await fetch('/api/qa/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        itemId: questionId,
        itemType: 'question',
        voteType,
      }),
    })

    if (!response.ok) {
      console.error('Vote request failed:', await response.text())
      return { success: false }
    }

    const data = (await response.json()) as VoteApiResponse
    return { success: !!data.success, currentVote: data.currentVote }
  } catch (error) {
    console.error('Failed to vote on question:', error)
    return { success: false }
  }
}

/**
 * Vote on an answer
 * Logged-in users only (free + premium equal access)
 * Uses Firestore transactions to prevent race conditions and double counting
 */
export async function voteAnswer(
  answerId: string,
  _userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    const response = await fetch('/api/qa/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        itemId: answerId,
        itemType: 'answer',
        voteType,
      }),
    })

    if (!response.ok) {
      console.error('Vote request failed:', await response.text())
      return { success: false }
    }

    const data = (await response.json()) as VoteApiResponse
    return { success: !!data.success, currentVote: data.currentVote }
  } catch (error) {
    console.error('Failed to vote on answer:', error)
    return { success: false }
  }
}

/**
 * Get user's existing vote on a question
 */
async function getUserQuestionVote(
  questionId: string,
  userId: string
): Promise<VoteType | null> {
  try {
    const votes = await getUserQuestionVotes([questionId], userId)
    return votes.get(questionId) || null
  } catch (error) {
    console.error('Failed to get user question vote:', error)
    return null
  }
}

/**
 * Get user's existing vote on an answer
 */
async function getUserAnswerVote(answerId: string, userId: string): Promise<VoteType | null> {
  try {
    const votes = await getUserAnswerVotes([answerId], userId)
    return votes.get(answerId) || null
  } catch (error) {
    console.error('Failed to get user answer vote:', error)
    return null
  }
}

/**
 * Get all user votes for questions (for batch loading)
 */
export async function getUserQuestionVotes(
  questionIds: string[],
  userId: string
): Promise<Map<string, VoteType>> {
  try {
    if (questionIds.length === 0) return new Map()

    const response = await fetch('/api/qa/get-user-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ questionIds }),
    })

    if (!response.ok) {
      return new Map()
    }

    const data = await response.json()
    const votes = new Map<string, VoteType>()

    Object.entries(data.questionVotes || {}).forEach(([questionId, vote]) => {
      votes.set(questionId, vote as VoteType)
    })

    return votes
  } catch (error) {
    console.error('Failed to get user question votes:', error)
    return new Map()
  }
}

/**
 * Get all user votes for answers (for batch loading)
 */
export async function getUserAnswerVotes(
  answerIds: string[],
  userId: string
): Promise<Map<string, VoteType>> {
  try {
    if (answerIds.length === 0) return new Map()

    const response = await fetch('/api/qa/get-user-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ answerIds }),
    })

    if (!response.ok) {
      return new Map()
    }

    const data = await response.json()
    const votes = new Map<string, VoteType>()

    Object.entries(data.answerVotes || {}).forEach(([answerId, vote]) => {
      votes.set(answerId, vote as VoteType)
    })

    return votes
  } catch (error) {
    console.error('Failed to get user answer votes:', error)
    return new Map()
  }
}

// Export getter functions for use in components
export { getUserQuestionVote, getUserAnswerVote }
