/**
 * Answers Service Tests
 * Tests for Q&A answers operations
 * Coverage target: 85%+
 */

import { createAnswer, getAnswersForQuestion, deleteAnswer } from '../answers'
import { collection, addDoc, getDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore'

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  increment: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: class MockTimestamp {
    toDate() {
      return new Date()
    }
  }
}))

jest.mock('@/lib/firebase/client', () => ({
  firestore: {}
}))

describe('Answers Service', () => {
  const mockUser = {
    uid: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://example.com/avatar.jpg'
  }

  const questionId = 'test-question-456'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createAnswer', () => {
    const validInput = {
      questionId,
      content: 'This is a helpful answer to your question.'
    }

    it('should validate answer content is not empty', async () => {
      const invalidInput = {
        questionId,
        content: ''
      }

      await expect(createAnswer(invalidInput, mockUser)).rejects.toThrow('Answer cannot be empty')

      try {
        await createAnswer(invalidInput, mockUser)
      } catch (error: any) {
        expect(error.code).toBe('INVALID_CONTENT')
      }
    })

    it('should validate answer content has no whitespace-only', async () => {
      const invalidInput = {
        questionId,
        content: '   '
      }

      await expect(createAnswer(invalidInput, mockUser)).rejects.toThrow('Answer cannot be empty')
    })

    it('should verify question exists before creating answer', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      await expect(createAnswer(validInput, mockUser)).rejects.toThrow()

      expect(getDoc).toHaveBeenCalled()
    })

    it('should create answer with pending moderation status', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Test Question',
          moderationStatus: 'approved'
        })
      })

      ;(addDoc as jest.Mock).mockResolvedValue({
        id: 'new-answer-id'
      })

      const result = await createAnswer(validInput, mockUser)

      expect(result.answerId).toBe('new-answer-id')
      expect(result.moderationStatus).toBe('pending')
      expect(addDoc).toHaveBeenCalled()
    })

    it('should include user information in answer', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          title: 'Test Question',
          moderationStatus: 'approved'
        })
      })

      const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-answer-id' })
      ;(addDoc as jest.Mock).mockImplementation(mockAddDoc)

      await createAnswer(validInput, mockUser)

      const callArgs = mockAddDoc.mock.calls[0]
      const answerData = callArgs[1]

      expect(answerData.author.uid).toBe(mockUser.uid)
      expect(answerData.author.name).toBe(mockUser.name)
      expect(answerData.author.email).toBe(mockUser.email)
    })

    it('should trim whitespace from answer content', async () => {
      const inputWithWhitespace = {
        questionId,
        content: '  Answer with whitespace  '
      }

      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ title: 'Test', moderationStatus: 'approved' })
      })

      const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-answer-id' })
      ;(addDoc as jest.Mock).mockImplementation(mockAddDoc)

      await createAnswer(inputWithWhitespace, mockUser)

      const callArgs = mockAddDoc.mock.calls[0]
      const answerData = callArgs[1]

      expect(answerData.content).toBe('Answer with whitespace')
    })

    it('should set initial vote counts to 0', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ title: 'Test', moderationStatus: 'approved' })
      })

      const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-answer-id' })
      ;(addDoc as jest.Mock).mockImplementation(mockAddDoc)

      await createAnswer(validInput, mockUser)

      const callArgs = mockAddDoc.mock.calls[0]
      const answerData = callArgs[1]

      expect(answerData.upvotes).toBe(0)
      expect(answerData.downvotes).toBe(0)
    })

    it('should set accepted to false initially', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ title: 'Test', moderationStatus: 'approved' })
      })

      const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-answer-id' })
      ;(addDoc as jest.Mock).mockImplementation(mockAddDoc)

      await createAnswer(validInput, mockUser)

      const callArgs = mockAddDoc.mock.calls[0]
      const answerData = callArgs[1]

      expect(answerData.accepted).toBe(false)
    })
  })

  describe('deleteAnswer', () => {
    it('should verify answer exists before deletion', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      await expect(deleteAnswer('answer-123', mockUser.uid)).rejects.toThrow()
    })

    it('should verify user is the author before deletion', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          content: 'Test answer',
          author: {
            uid: 'different-user',
            name: 'Other User'
          }
        })
      })

      await expect(deleteAnswer('answer-123', mockUser.uid)).rejects.toThrow()
    })

    it('should allow author to delete their own answer', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          content: 'Test answer',
          questionId: 'question-123',
          author: {
            uid: mockUser.uid,
            name: mockUser.name
          }
        })
      })

      ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)

      await expect(deleteAnswer('answer-123', mockUser.uid)).resolves.not.toThrow()
      expect(deleteDoc).toHaveBeenCalled()
    })
  })

  describe('getAnswers', () => {
    it('should retrieve answers for a question', async () => {
      const mockAnswers = [
        {
          id: 'answer-1',
          data: () => ({
            questionId,
            content: 'Answer 1',
            author: { uid: 'user-1', name: 'User 1', email: 'user1@test.com' },
            upvotes: 5,
            downvotes: 0,
            accepted: false,
            moderationStatus: 'approved',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        },
        {
          id: 'answer-2',
          data: () => ({
            questionId,
            content: 'Answer 2',
            author: { uid: 'user-2', name: 'User 2', email: 'user2@test.com' },
            upvotes: 3,
            downvotes: 1,
            accepted: true,
            moderationStatus: 'approved',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }
      ]

      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: mockAnswers,
        empty: false
      })

      const answers = await getAnswersForQuestion(questionId)

      expect(answers).toHaveLength(2)
      expect(answers[0].id).toBe('answer-1')
      expect(answers[1].accepted).toBe(true)
    })

    it('should return empty array when no answers exist', async () => {
      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: [],
        empty: true
      })

      const answers = await getAnswersForQuestion(questionId)

      expect(answers).toEqual([])
    })

    it('should only return approved answers', async () => {
      const mockAnswers = [
        {
          id: 'answer-1',
          data: () => ({
            questionId,
            content: 'Approved answer',
            author: { uid: 'user-1', name: 'User 1', email: 'user1@test.com' },
            moderationStatus: 'approved',
            upvotes: 0,
            downvotes: 0,
            accepted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        }
      ]

      ;(getDocs as jest.Mock).mockResolvedValue({
        docs: mockAnswers,
        empty: false
      })

      const answers = await getAnswersForQuestion(questionId)

      expect(where).toHaveBeenCalledWith('moderationStatus', '==', 'approved')
    })
  })

  describe('Edge Cases', () => {
    it('should handle Firestore not initialized', async () => {
      const { firestore } = require('@/lib/firebase/client')
      const originalDb = firestore

      // Temporarily set to null
      require('@/lib/firebase/client').firestore = null

      await expect(createAnswer({
        questionId: 'test',
        content: 'Test answer'
      }, mockUser)).rejects.toThrow('Firestore is not initialized')

      // Restore
      require('@/lib/firebase/client').firestore = originalDb
    })

    it('should handle very long answer content', async () => {
      const longContent = 'a'.repeat(10000)

      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ title: 'Test', moderationStatus: 'approved' })
      })

      ;(addDoc as jest.Mock).mockResolvedValue({ id: 'new-answer-id' })

      await expect(createAnswer({
        questionId,
        content: longContent
      }, mockUser)).resolves.not.toThrow()
    })
  })
})
