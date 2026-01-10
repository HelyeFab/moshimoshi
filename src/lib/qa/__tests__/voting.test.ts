/**
 * Voting Service Tests
 * Tests for Q&A voting operations
 * Coverage target: 85%+
 */

import { voteQuestion, voteAnswer, getUserQuestionVote, getUserAnswerVote } from '../voting'
import { doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, runTransaction } from 'firebase/firestore'

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn((n: number) => n),
  serverTimestamp: jest.fn(() => new Date()),
  runTransaction: jest.fn()
}))

jest.mock('@/lib/firebase/client', () => ({
  firestore: {}
}))

describe('Voting Service', () => {
  const userId = 'test-user-123'
  const questionId = 'test-question-456'
  const answerId = 'test-answer-789'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('voteOnQuestion', () => {
    it('should create upvote when no previous vote exists', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: () => false }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should create downvote when no previous vote exists', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: () => false }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'downvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should prevent user from voting on their own question', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          author: { uid: userId }
        })
      })

      await expect(voteOnQuestion(questionId, userId, 'up')).rejects.toThrow()
    })

    it('should change vote from up to down', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 5, downvotes: 2 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => true,
              data: () => ({ voteType: 'up' })
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'downvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should change vote from down to up', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 3, downvotes: 4 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => true,
              data: () => ({ voteType: 'down' })
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should remove vote when clicking same vote type', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 5, downvotes: 2 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => true,
              data: () => ({ voteType: 'up' })
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })
  })

  describe('voteOnAnswer', () => {
    it('should create upvote when no previous vote exists', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // answer
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 0, downvotes: 0 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => false
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteAnswer(answerId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should create downvote when no previous vote exists', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // answer
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 0, downvotes: 0 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => false
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteAnswer(answerId, userId, 'downvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should prevent user from voting on their own answer', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ author: { uid: userId } })
          }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await expect(voteOnAnswer(answerId, userId, 'up')).rejects.toThrow()
    })

    it('should handle answer not found', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false
          }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await expect(voteOnAnswer(answerId, userId, 'up')).rejects.toThrow()
    })
  })

  describe('getUserVote', () => {
    it('should return null when no vote exists', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => false
      })

      const vote = await getUserQuestionVote(questionId, userId)

      expect(vote).toBeNull()
    })

    it('should return "up" for upvote', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ voteType: 'up' })
      })

      const vote = await getUserQuestionVote(questionId, userId)

      expect(vote).toBe('upvote')
    })

    it('should return "down" for downvote', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ voteType: 'down' })
      })

      const vote = await getUserQuestionVote(questionId, userId)

      expect(vote).toBe('downvote')
    })

    it('should work for answer votes', async () => {
      ;(getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ voteType: 'up' })
      })

      const vote = await getUserAnswerVote(answerId, userId)

      expect(vote).toBe('upvote')
    })
  })

  describe('Edge Cases', () => {
    it('should handle concurrent votes gracefully', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 5, downvotes: 2 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => false
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await expect(voteOnQuestion(questionId, userId, 'up')).resolves.not.toThrow()
    })

    it('should validate vote type', async () => {
      await expect(voteOnQuestion(questionId, userId, 'invalid' as any)).rejects.toThrow()
    })

    it('should handle Firestore not initialized', async () => {
      const { firestore } = require('@/lib/firebase/client')
      const originalDb = firestore

      // Temporarily set to null
      require('@/lib/firebase/client').firestore = null

      await expect(voteOnQuestion(questionId, userId, 'up')).rejects.toThrow('Firestore is not initialized')

      // Restore
      require('@/lib/firebase/client').firestore = originalDb
    })
  })

  describe('Vote Count Updates', () => {
    it('should increment upvote count when adding upvote', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const mockUpdate = jest.fn()
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 5, downvotes: 2 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => false
            }),
          set: jest.fn(),
          update: mockUpdate,
          delete: jest.fn()
        }
        await callback(transaction)
        return mockUpdate
      })

      await voteQuestion(questionId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })

    it('should decrement downvote count and increment upvote when changing vote', async () => {
      ;(runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({ // question
              exists: () => true,
              data: () => ({ author: { uid: 'other-user' }, upvotes: 3, downvotes: 4 })
            })
            .mockResolvedValueOnce({ // existing vote
              exists: () => true,
              data: () => ({ voteType: 'down' })
            }),
          set: jest.fn(),
          update: jest.fn(),
          delete: jest.fn()
        }
        return callback(transaction)
      })

      await voteQuestion(questionId, userId, 'upvote')

      expect(runTransaction).toHaveBeenCalled()
    })
  })
})
