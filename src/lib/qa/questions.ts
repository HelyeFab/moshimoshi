/**
 * Questions Service
 * Firestore operations for Q&A questions
 * Adapted from DevTalks blog.ts
 *
 * IMPORTANT: All authenticated users (free + premium) can post questions
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
  runTransaction,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { firestore as db } from '@/lib/firebase/client'
import type {
  Question,
  CreateQuestionInput,
  QuestionFilter,
  QuestionSortBy,
  QA_COLLECTIONS,
} from '@/types/qa'

const QUESTIONS_COLLECTION = 'qa_questions'

/**
 * Error class for Q&A operations
 */
class QAError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'QAError'
  }
}

/**
 * Convert Firestore document to Question type
 */
function convertToQuestion(id: string, data: DocumentData): Question {
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
    title: String(data.title || ''),
    content: String(data.content || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: {
      uid: String(data.author?.uid || ''),
      name: String(data.author?.name || ''),
      email: String(data.author?.email || ''),
      avatar: data.author?.avatar,
      level: data.author?.level,
    },
    upvotes: typeof data.upvotes === 'number' ? data.upvotes : 0,
    downvotes: typeof data.downvotes === 'number' ? data.downvotes : 0,
    answerCount: typeof data.answerCount === 'number' ? data.answerCount : 0,
    viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
    hasAcceptedAnswer: Boolean(data.hasAcceptedAnswer),
    acceptedAnswerId: data.acceptedAnswerId,
    moderationStatus: data.moderationStatus || 'pending',
    moderationReason: data.moderationReason,
    moderatedAt: data.moderatedAt,
    createdAt,
    updatedAt,
    difficulty: data.difficulty,
    relatedArticleId: data.relatedArticleId,
  }
}

/**
 * Create a new question (with AI moderation)
 * Available to ALL logged-in users (free + premium)
 */
export async function createQuestion(
  input: CreateQuestionInput,
  user: { uid: string; name: string; email: string; avatar?: string }
): Promise<{ questionId: string; moderationStatus: 'pending' | 'approved' | 'rejected' }> {
  try {
    if (!db) {
      throw new QAError('Firestore is not initialized')
    }

    // Validate input
    if (!input.title || input.title.trim().length < 10) {
      throw new QAError('Question title must be at least 10 characters', 'INVALID_TITLE')
    }

    if (!input.content || input.content.trim().length < 20) {
      throw new QAError('Question details must be at least 20 characters', 'INVALID_CONTENT')
    }

    if (!input.tags || input.tags.length === 0) {
      throw new QAError('Please select at least one topic tag', 'MISSING_TAGS')
    }

    // Create question document (initially pending - will be moderated by Cloud Function)
    const questionData: any = {
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags,
      author: {
        uid: user.uid,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      upvotes: 0,
      downvotes: 0,
      answerCount: 0,
      viewCount: 0,
      hasAcceptedAnswer: false,
      moderationStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    // Only add optional fields if they're defined (Firestore doesn't allow undefined)
    if (input.difficulty) {
      questionData.difficulty = input.difficulty
    }
    if (input.relatedArticleId) {
      questionData.relatedArticleId = input.relatedArticleId
    }

    const docRef = await addDoc(collection(db, QUESTIONS_COLLECTION), questionData)

    // Note: Moderation will be handled by Cloud Function trigger
    // The function watches for new 'pending' documents and moderates them

    return {
      questionId: docRef.id,
      moderationStatus: 'pending',
    }
  } catch (error) {
    if (error instanceof QAError) throw error
    console.error('Failed to create question:', error)
    throw new QAError('Failed to create question. Please try again.')
  }
}

/**
 * Moderate question using AI (background process)
 * NOTE: This is now handled by Cloud Function (functions/src/qa-moderation.ts)
 * Keeping this code for reference/backup only
 */
// async function moderateQuestion(
//   questionId: string,
//   input: CreateQuestionInput,
//   userId: string
// ): Promise<void> {
//   // Moderation is handled server-side by Cloud Functions
//   // See: functions/src/qa-moderation.ts
// }

/**
 * Get all approved questions (with filters)
 * Public - available to ALL users (including guests for read-only)
 */
export async function getQuestions(
  filter?: QuestionFilter,
  sortBy: QuestionSortBy = 'recent',
  limitCount: number = 20
): Promise<Question[]> {
  try {
    if (!db) throw new QAError('Firestore is not initialized')

    let q = query(
      collection(db, QUESTIONS_COLLECTION),
      where('moderationStatus', '==', 'approved')
    )

    // Apply filters
    if (filter?.tags && filter.tags.length > 0) {
      q = query(q, where('tags', 'array-contains-any', filter.tags))
    }

    if (filter?.difficulty) {
      q = query(q, where('difficulty', '==', filter.difficulty))
    }

    if (filter?.hasAcceptedAnswer !== undefined) {
      q = query(q, where('hasAcceptedAnswer', '==', filter.hasAcceptedAnswer))
    }

    if (filter?.authorId) {
      q = query(q, where('author.uid', '==', filter.authorId))
    }

    // Apply sorting
    switch (sortBy) {
      case 'recent':
        q = query(q, orderBy('createdAt', 'desc'))
        break
      case 'popular':
        q = query(q, orderBy('upvotes', 'desc'), orderBy('createdAt', 'desc'))
        break
      case 'unanswered':
        q = query(q, where('answerCount', '==', 0), orderBy('createdAt', 'desc'))
        break
    }

    q = query(q, limit(limitCount))

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => convertToQuestion(doc.id, doc.data()))
  } catch (error) {
    console.error('Failed to fetch questions:', error)
    throw new QAError('Failed to load questions')
  }
}

/**
 * Get single question by ID
 * Public - available to all (increments view count)
 */
export async function getQuestion(questionId: string): Promise<Question | null> {
  try {
    if (!db) throw new QAError('Firestore is not initialized')

    const docRef = doc(db, QUESTIONS_COLLECTION, questionId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      return null
    }

    // Increment view count
    updateDoc(docRef, { viewCount: increment(1) }).catch(error => {
      console.error('Failed to increment view count:', error)
    })

    return convertToQuestion(snapshot.id, snapshot.data())
  } catch (error) {
    console.error('Failed to fetch question:', error)
    return null
  }
}

/**
 * Update question (author only)
 */
export async function updateQuestion(
  questionId: string,
  updates: Partial<CreateQuestionInput>,
  userId: string
): Promise<void> {
  try {
    if (!db) throw new QAError('Firestore is not initialized')

    const docRef = doc(db, QUESTIONS_COLLECTION, questionId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      throw new QAError('Question not found', 'NOT_FOUND')
    }

    const question = snapshot.data()
    if (question.author?.uid !== userId) {
      throw new QAError('You can only edit your own questions', 'UNAUTHORIZED')
    }

    // Filter out undefined values (Firestore doesn't allow them)
    const updateData: any = {
      updatedAt: serverTimestamp(),
      // Re-trigger moderation on content changes
      moderationStatus: 'pending',
    }

    // Only add fields that are defined
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.tags !== undefined) updateData.tags = updates.tags
    if (updates.difficulty !== undefined) updateData.difficulty = updates.difficulty
    if (updates.relatedArticleId !== undefined) updateData.relatedArticleId = updates.relatedArticleId

    await updateDoc(docRef, updateData)

    // Note: Re-moderation will be handled by Cloud Function when it detects moderationStatus = 'pending'
    // No client-side moderation needed
  } catch (error) {
    if (error instanceof QAError) throw error
    console.error('Failed to update question:', error)
    throw new QAError('Failed to update question')
  }
}

/**
 * Delete question (author only)
 */
export async function deleteQuestion(questionId: string, userId: string): Promise<void> {
  try {
    if (!db) throw new QAError('Firestore is not initialized')

    const docRef = doc(db, QUESTIONS_COLLECTION, questionId)
    const snapshot = await getDoc(docRef)

    if (!snapshot.exists()) {
      throw new QAError('Question not found', 'NOT_FOUND')
    }

    const question = snapshot.data()
    if (question.author?.uid !== userId) {
      throw new QAError('You can only delete your own questions', 'UNAUTHORIZED')
    }

    // Helper to delete a collection query in batches (max 500 writes)
    const deleteByQuery = async (q: any) => {
      const results = await getDocs(q)
      if (results.empty) return

      let batch = writeBatch(db)
      let ops = 0

      for (const docSnap of results.docs) {
        batch.delete(docSnap.ref)
        ops++

        if (ops === 450) {
          await batch.commit()
          batch = writeBatch(db)
          ops = 0
        }
      }

      if (ops > 0) {
        await batch.commit()
      }
    }

    // Delete answer votes, answers, and question votes before removing the question
    const answersQuery = query(collection(db, 'qa_answers'), where('questionId', '==', questionId))
    const answersSnapshot = await getDocs(answersQuery)

    // Delete votes for each answer, then the answers themselves
    for (const answerDoc of answersSnapshot.docs) {
      const answerId = answerDoc.id
      const answerVotesQuery = query(
        collection(db, 'qa_answer_votes'),
        where('answerId', '==', answerId)
      )
      await deleteByQuery(answerVotesQuery)
    }
    await deleteByQuery(answersQuery)

    // Delete question votes
    const questionVotesQuery = query(
      collection(db, 'qa_question_votes'),
      where('questionId', '==', questionId)
    )
    await deleteByQuery(questionVotesQuery)

    // Finally delete the question
    await deleteDoc(docRef)
  } catch (error) {
    if (error instanceof QAError) throw error
    console.error('Failed to delete question:', error)
    throw new QAError('Failed to delete question')
  }
}

/**
 * Mark answer as accepted (question author only)
 */
export async function acceptAnswer(
  questionId: string,
  answerId: string,
  userId: string
): Promise<void> {
  try {
    if (!db) throw new QAError('Firestore is not initialized')

    await runTransaction(db, async transaction => {
      const questionRef = doc(db, QUESTIONS_COLLECTION, questionId)
      const answerRef = doc(db, 'qa_answers', answerId)

      const questionSnap = await transaction.get(questionRef)
      if (!questionSnap.exists()) {
        throw new QAError('Question not found', 'NOT_FOUND')
      }

      const answerSnap = await transaction.get(answerRef)
      if (!answerSnap.exists()) {
        throw new QAError('Answer not found', 'NOT_FOUND')
      }

      const question = questionSnap.data()
      const answer = answerSnap.data()

      if (question.author?.uid !== userId) {
        throw new QAError('Only the question author can accept answers', 'UNAUTHORIZED')
      }

      // Ensure the answer belongs to this question
      if (answer.questionId !== questionId) {
        throw new QAError('Answer does not belong to this question', 'INVALID_ANSWER')
      }

      const previousAcceptedId = question.acceptedAnswerId

      // Mark selected answer as accepted
      transaction.update(answerRef, {
        accepted: true,
        updatedAt: serverTimestamp(),
      })

      // Unmark previously accepted answer if different
      if (previousAcceptedId && previousAcceptedId !== answerId) {
        const previousAnswerRef = doc(db, 'qa_answers', previousAcceptedId)
        const prevSnap = await transaction.get(previousAnswerRef)
        if (prevSnap.exists()) {
          transaction.update(previousAnswerRef, {
            accepted: false,
            updatedAt: serverTimestamp(),
          })
        }
      }

      // Update question metadata
      transaction.update(questionRef, {
        hasAcceptedAnswer: true,
        acceptedAnswerId: answerId,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    if (error instanceof QAError) throw error
    console.error('Failed to accept answer:', error)
    throw new QAError('Failed to accept answer')
  }
}

export { QAError }
