/**
 * Answers Service
 * Firestore operations for Q&A answers
 *
 * IMPORTANT: All authenticated users (free + premium) can post answers
 * NO subscription checks in this file
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  increment,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'
import type { Answer, CreateAnswerInput } from '@/types/qa'

const ANSWERS_COLLECTION = 'qa_answers'
const QUESTIONS_COLLECTION = 'qa_questions'

/**
 * Error class for answer operations
 */
class AnswerError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'AnswerError'
  }
}

/**
 * Convert Firestore document to Answer type
 */
function convertToAnswer(id: string, data: DocumentData): Answer {
  const createdAt =
    data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : typeof data.createdAt === 'string'
        ? data.createdAt
        : new Date().toISOString()

  const updatedAt =
    data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : createdAt

  return {
    id,
    questionId: String(data.questionId || ''),
    content: String(data.content || ''),
    author: {
      uid: String(data.author?.uid || ''),
      name: String(data.author?.name || ''),
      email: String(data.author?.email || ''),
      avatar: data.author?.avatar,
      level: data.author?.level,
    },
    upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
    downvotes: typeof data.downvotes === 'number' ? data.downvotes : 0,
    accepted: Boolean(data.accepted),
    moderationStatus: data.moderationStatus || 'pending',
    moderationReason: data.moderationReason,
    moderatedAt: data.moderatedAt,
    createdAt,
    updatedAt,
  }
}

/**
 * Create a new answer (with AI moderation)
 * Available to ALL logged-in users (free + premium)
 */
export async function createAnswer(
  input: CreateAnswerInput,
  user: { uid: string; name: string; email: string; avatar?: string }
): Promise<{ answerId: string; moderationStatus: 'pending' | 'approved' | 'rejected' }> {
  try {
    if (!db) {
      throw new AnswerError('Firestore is not initialized')
    }

    // Validate input
    if (!input.content || input.content.trim().length === 0) {
      throw new AnswerError('Answer cannot be empty', 'INVALID_CONTENT')
    }

    // Verify question exists
    const questionRef = doc(db, QUESTIONS_COLLECTION, input.questionId)
    const questionSnap = await getDoc(questionRef)

    if (!questionSnap.exists()) {
      throw new AnswerError('Question not found', 'QUESTION_NOT_FOUND')
    }

    // Create answer document (initially pending - will be moderated by Cloud Function)
    const answerData = {
      questionId: input.questionId,
      content: input.content.trim(),
      author: {
        uid: user.uid,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      upvotes: 0,
      downvotes: 0,
      accepted: false,
      moderationStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(collection(db, ANSWERS_COLLECTION), answerData)

    // Note: Moderation will be handled by Cloud Function trigger
    // Answer count will be incremented when approved

    return {
      answerId: docRef.id,
      moderationStatus: 'pending',
    }
  } catch (error) {
    if (error instanceof AnswerError) throw error
    console.error('Failed to create answer:', error)
    throw new AnswerError('Failed to post answer. Please try again.')
  }
}

/**
 * Moderate answer using AI (background process)
 * NOTE: This is now handled by Cloud Function (functions/src/qa-moderation.ts)
 * Keeping this code for reference/backup only
 */
// async function moderateAnswer(
//   answerId: string,
//   input: CreateAnswerInput,
//   userId: string
// ): Promise<void> {
//   // Moderation is handled server-side by Cloud Functions
//   // See: functions/src/qa-moderation.ts
// }

/**
 * Get all approved answers for a question
 * Public - available to ALL users (including guests)
 */
export async function getAnswersForQuestion(
  questionId: string,
  sortBy: 'recent' | 'popular' | 'accepted' = 'popular'
): Promise<Answer[]> {
  try {
    if (!db) throw new AnswerError('Firestore is not initialized')

    let q = query(
      collection(db, ANSWERS_COLLECTION),
      where('questionId', '==', questionId),
      where('moderationStatus', '==', 'approved')
    )

    // Apply sorting
    switch (sortBy) {
      case 'accepted':
        // Accepted first, then by upvotes
        q = query(q, orderBy('accepted', 'desc'), orderBy('upvotes', 'desc'))
        break
      case 'popular':
        q = query(q, orderBy('upvotes', 'desc'), orderBy('createdAt', 'desc'))
        break
      case 'recent':
        q = query(q, orderBy('createdAt', 'desc'))
        break
    }

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => convertToAnswer(doc.id, doc.data()))
  } catch (error) {
    console.error('Failed to fetch answers:', error)
    throw new AnswerError('Failed to load answers')
  }
}

/**
 * Get single answer by ID
 */
export async function getAnswer(answerId: string): Promise<Answer | null> {
  try {
    if (!db) throw new AnswerError('Firestore is not initialized')

    const docRef = doc(db, ANSWERS_COLLECTION, answerId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      return null
    }

    return convertToAnswer(snapshot.id, snapshot.data())
  } catch (error) {
    console.error('Failed to fetch answer:', error)
    return null
  }
}

/**
 * Update answer (author only)
 */
export async function updateAnswer(
  answerId: string,
  content: string,
  userId: string
): Promise<void> {
  try {
    if (!db) throw new AnswerError('Firestore is not initialized')

    const docRef = doc(db, ANSWERS_COLLECTION, answerId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      throw new AnswerError('Answer not found', 'NOT_FOUND')
    }

    const answer = snapshot.data()
    if (answer.author?.uid !== userId) {
      throw new AnswerError('You can only edit your own answers', 'UNAUTHORIZED')
    }

    await updateDoc(docRef, {
      content: content.trim(),
      updatedAt: serverTimestamp(),
      // Re-trigger moderation on content changes
      moderationStatus: 'pending',
    })

    // Note: Re-moderation will be handled by Cloud Function when it detects moderationStatus = 'pending'
    // No client-side moderation needed
  } catch (error) {
    if (error instanceof AnswerError) throw error
    console.error('Failed to update answer:', error)
    throw new AnswerError('Failed to update answer')
  }
}

/**
 * Delete answer (author only)
 */
export async function deleteAnswer(answerId: string, userId: string): Promise<void> {
  try {
    if (!db) throw new AnswerError('Firestore is not initialized')

    const docRef = doc(db, ANSWERS_COLLECTION, answerId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      throw new AnswerError('Answer not found', 'NOT_FOUND')
    }

    const answer = snapshot.data()
    if (answer.author?.uid !== userId) {
      throw new AnswerError('You can only delete your own answers', 'UNAUTHORIZED')
    }

    // Delete answer
    await deleteDoc(docRef)

    // Decrement answer count on question (if answer was approved)
    if (answer.moderationStatus === 'approved') {
      const questionRef = doc(db, QUESTIONS_COLLECTION, answer.questionId)
      await updateDoc(questionRef, {
        answerCount: increment(-1),
      })
    }
  } catch (error) {
    if (error instanceof AnswerError) throw error
    console.error('Failed to delete answer:', error)
    throw new AnswerError('Failed to delete answer')
  }
}

export { AnswerError }
