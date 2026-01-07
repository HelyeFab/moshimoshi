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

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'

const QUESTION_VOTES_COLLECTION = 'qa_question_votes'
const ANSWER_VOTES_COLLECTION = 'qa_answer_votes'

export type VoteType = 'upvote' | 'downvote'

/**
 * Vote on a question
 * Logged-in users only (free + premium equal access)
 * Uses Firestore transactions to prevent race conditions and double counting
 */
export async function voteQuestion(
  questionId: string,
  userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    if (!db) throw new Error('Firestore not initialized')

    // Use deterministic document ID to avoid query in transaction
    const voteDocId = `${userId}_${questionId}`
    const voteRef = doc(db, QUESTION_VOTES_COLLECTION, voteDocId)
    const questionRef = doc(db, 'qa_questions', questionId)

    // Use transaction to avoid race conditions when checking existing vote and question existence
    const result = await runTransaction(db, async (transaction) => {
      console.log('[Voting] Transaction starting for question:', questionId, 'voteType:', voteType, 'userId:', userId)

      // 1. Read existing vote document
      const voteSnap = await transaction.get(voteRef)
      const existingVote = voteSnap.exists() ? (voteSnap.data()?.voteType as VoteType) : null
      console.log('[Voting] Existing vote:', existingVote, 'exists:', voteSnap.exists())

      // 2. Read question to verify it exists
      const questionSnap = await transaction.get(questionRef)
      if (!questionSnap.exists()) {
        throw new Error('Question not found')
      }
      // 3. Determine what action to take (server-side functions will adjust counts)
      let newVote: VoteType | undefined = undefined

      if (existingVote === voteType) {
        // Toggle off - remove vote
        console.log('[Voting] Toggling off existing vote')
        transaction.delete(voteRef)
        newVote = undefined
      } else if (existingVote) {
        // Change vote type
        console.log('[Voting] Changing vote type from', existingVote, 'to', voteType)
        transaction.set(voteRef, {
          questionId,
          userId,
          voteType,
          createdAt: serverTimestamp(),
        })
        newVote = voteType
      } else {
        // New vote
        console.log('[Voting] Creating new vote')
        transaction.set(voteRef, {
          questionId,
          userId,
          voteType,
          createdAt: serverTimestamp(),
        })
        newVote = voteType
      }

      return { currentVote: newVote }
    })

    return { success: true, ...result }
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
  userId: string,
  voteType: VoteType
): Promise<{ success: boolean; currentVote?: VoteType }> {
  try {
    if (!db) throw new Error('Firestore not initialized')

    // Use deterministic document ID to avoid query in transaction
    const voteDocId = `${userId}_${answerId}`
    const voteRef = doc(db, ANSWER_VOTES_COLLECTION, voteDocId)
    const answerRef = doc(db, 'qa_answers', answerId)

    // Use transaction to avoid race conditions when checking existing vote and answer existence
    const result = await runTransaction(db, async (transaction) => {
      // 1. Read existing vote document
      const voteSnap = await transaction.get(voteRef)
      const existingVote = voteSnap.exists() ? (voteSnap.data()?.voteType as VoteType) : null

      // 2. Read answer to verify it exists
      const answerSnap = await transaction.get(answerRef)
      if (!answerSnap.exists()) {
        throw new Error('Answer not found')
      }

      // 3. Determine what action to take
      let upvotesDelta = 0
      let downvotesDelta = 0
      let newVote: VoteType | undefined = undefined

      if (existingVote === voteType) {
        // Toggle off - remove vote
        transaction.delete(voteRef)
        newVote = undefined
      } else if (existingVote) {
        // Change vote type
        transaction.set(voteRef, {
          answerId,
          userId,
          voteType,
          createdAt: serverTimestamp(),
        })

        newVote = voteType
      } else {
        // New vote
        transaction.set(voteRef, {
          answerId,
          userId,
          voteType,
          createdAt: serverTimestamp(),
        })

        newVote = voteType
      }

      return { currentVote: newVote }
    })

    return { success: true, ...result }
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
    if (!db) return null

    // Use deterministic document ID to match security rules
    const voteDocId = `${userId}_${questionId}`
    const voteRef = doc(db, QUESTION_VOTES_COLLECTION, voteDocId)
    const snapshot = await getDoc(voteRef)

    if (!snapshot.exists()) return null

    return snapshot.data().voteType as VoteType
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
    if (!db) return null

    // Use deterministic document ID to match security rules
    const voteDocId = `${userId}_${answerId}`
    const voteRef = doc(db, ANSWER_VOTES_COLLECTION, voteDocId)
    const snapshot = await getDoc(voteRef)

    if (!snapshot.exists()) return null

    return snapshot.data().voteType as VoteType
  } catch (error) {
    console.error('Failed to get user answer vote:', error)
    return null
  }
}

/**
 * Remove question vote
 */
async function removeQuestionVote(questionId: string, userId: string): Promise<void> {
  try {
    if (!db) return

    const q = query(
      collection(db, QUESTION_VOTES_COLLECTION),
      where('questionId', '==', questionId),
      where('userId', '==', userId)
    )

    const snapshot = await getDocs(q)
    if (snapshot.empty) return

    const voteDoc = snapshot.docs[0]

    // Delete vote
    // Server-side Cloud Function will automatically update question counts
    await deleteDoc(voteDoc.ref)
  } catch (error) {
    console.error('Failed to remove question vote:', error)
  }
}

/**
 * Remove answer vote
 */
async function removeAnswerVote(answerId: string, userId: string): Promise<void> {
  try {
    if (!db) return

    const q = query(
      collection(db, ANSWER_VOTES_COLLECTION),
      where('answerId', '==', answerId),
      where('userId', '==', userId)
    )

    const snapshot = await getDocs(q)
    if (snapshot.empty) return

    const voteDoc = snapshot.docs[0]

    // Delete vote
    // Server-side Cloud Function will automatically update answer counts
    await deleteDoc(voteDoc.ref)
  } catch (error) {
    console.error('Failed to remove answer vote:', error)
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
    if (!db || questionIds.length === 0) return new Map()

    // Use deterministic document IDs to match security rules
    // Fetch all vote documents in parallel
    const votePromises = questionIds.map(async (questionId) => {
      const voteDocId = `${userId}_${questionId}`
      const voteRef = doc(db, QUESTION_VOTES_COLLECTION, voteDocId)
      const snapshot = await getDoc(voteRef)

      if (snapshot.exists()) {
        return { questionId, voteType: snapshot.data().voteType as VoteType }
      }
      return null
    })

    const results = await Promise.all(votePromises)
    const votes = new Map<string, VoteType>()

    results.forEach(result => {
      if (result) {
        votes.set(result.questionId, result.voteType)
      }
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
    if (!db || answerIds.length === 0) return new Map()

    // Use deterministic document IDs to match security rules
    // Fetch all vote documents in parallel
    const votePromises = answerIds.map(async (answerId) => {
      const voteDocId = `${userId}_${answerId}`
      const voteRef = doc(db, ANSWER_VOTES_COLLECTION, voteDocId)
      const snapshot = await getDoc(voteRef)

      if (snapshot.exists()) {
        return { answerId, voteType: snapshot.data().voteType as VoteType }
      }
      return null
    })

    const results = await Promise.all(votePromises)
    const votes = new Map<string, VoteType>()

    results.forEach(result => {
      if (result) {
        votes.set(result.answerId, result.voteType)
      }
    })

    return votes
  } catch (error) {
    console.error('Failed to get user answer votes:', error)
    return new Map()
  }
}

// Export getter functions for use in components
export { getUserQuestionVote, getUserAnswerVote }
