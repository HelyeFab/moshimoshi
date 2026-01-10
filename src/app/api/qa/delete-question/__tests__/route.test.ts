/**
 * DELETE /api/qa/delete-question API Route Tests
 * Tests for server-side question deletion with cascade delete
 * Coverage target: 95%+ (critical security path)
 */

import { NextRequest } from 'next/server'
import { DELETE } from '../route'
import { adminDb } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'

// Mock Firebase Admin
jest.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        delete: jest.fn()
      })),
      where: jest.fn(() => ({
        get: jest.fn()
      }))
    })),
    batch: jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn()
    }))
  }
}))

// Mock auth session
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn()
}))

describe('DELETE /api/qa/delete-question', () => {
  const mockSession = {
    uid: 'test-user-123',
    email: 'test@example.com'
  }

  const questionId = 'test-question-456'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should return 401 when no session exists', async () => {
      ;(getSession as jest.Mock).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when session has no uid', async () => {
      ;(getSession as jest.Mock).mockResolvedValue({ email: 'test@example.com' })

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should accept valid session', async () => {
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)

      const mockQuestionDoc = {
        exists: false,
        data: () => null
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc)
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue(mockQuestionRef)
      })

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)

      // Should not be 401
      expect(response.status).not.toBe(401)
    })
  })

  describe('Question Validation', () => {
    beforeEach(() => {
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)
    })

    it('should return 404 when question does not exist', async () => {
      const mockQuestionDoc = {
        exists: false,
        data: () => null
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc)
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue(mockQuestionRef)
      })

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Question not found')
    })

    it('should return 403 when user is not the author', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: 'different-user-789',
            name: 'Other User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc)
      }

      ;(adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn().mockReturnValue(mockQuestionRef)
      })

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Unauthorized - not the author')
    })
  })

  describe('Approved Answers Check (Option C Logic)', () => {
    beforeEach(() => {
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)
    })

    it('should BLOCK deletion when approved answers from OTHER users exist', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc)
      }

      // Mock answers: 1 approved from other user
      const mockAnswersSnapshot = {
        docs: [
          {
            id: 'answer-1',
            data: () => ({
              moderationStatus: 'approved',
              author: { uid: 'other-user-999', name: 'Other User' }
            })
          }
        ],
        size: 1
      }

      const mockAnswersQuery = {
        get: jest.fn().mockResolvedValue(mockAnswersSnapshot)
      }

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue(mockAnswersQuery) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Cannot delete question with approved answers from other users')
      expect(data.code).toBe('HAS_APPROVED_ANSWERS')
    })

    it('should ALLOW deletion when only rejected answers exist', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      // Mock answers: 2 rejected answers from other users
      const mockAnswersSnapshot = {
        docs: [
          {
            id: 'answer-1',
            ref: { path: 'qa_answers/answer-1' },
            data: () => ({
              moderationStatus: 'rejected',
              author: { uid: 'other-user-111', name: 'User 1' }
            })
          },
          {
            id: 'answer-2',
            ref: { path: 'qa_answers/answer-2' },
            data: () => ({
              moderationStatus: 'rejected',
              author: { uid: 'other-user-222', name: 'User 2' }
            })
          }
        ],
        size: 2
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswersSnapshot) }) }
        }
        if (collectionName === 'qa_answer_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockBatch.commit).toHaveBeenCalled()
    })

    it('should ALLOW deletion when only pending answers exist', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      // Mock answers: 1 pending answer
      const mockAnswersSnapshot = {
        docs: [
          {
            id: 'answer-1',
            ref: { path: 'qa_answers/answer-1' },
            data: () => ({
              moderationStatus: 'pending',
              author: { uid: 'other-user-333', name: 'User 3' }
            })
          }
        ],
        size: 1
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswersSnapshot) }) }
        }
        if (collectionName === 'qa_answer_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should ALLOW deletion when approved answers are from the question AUTHOR', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      // Mock answers: 1 approved answer from question author
      const mockAnswersSnapshot = {
        docs: [
          {
            id: 'answer-1',
            ref: { path: 'qa_answers/answer-1' },
            data: () => ({
              moderationStatus: 'approved',
              author: { uid: mockSession.uid, name: 'Test User' }
            })
          }
        ],
        size: 1
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswersSnapshot) }) }
        }
        if (collectionName === 'qa_answer_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should ALLOW deletion when no answers exist', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      // Mock answers: none
      const mockAnswersSnapshot = {
        docs: [],
        size: 0
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswersSnapshot) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Cascade Delete', () => {
    beforeEach(() => {
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)
    })

    it('should delete answer votes before deleting answers', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      const mockAnswer = {
        id: 'answer-1',
        ref: { path: 'qa_answers/answer-1' },
        data: () => ({
          moderationStatus: 'rejected',
          author: { uid: mockSession.uid, name: 'Test User' }
        })
      }

      const mockAnswersSnapshot = {
        docs: [mockAnswer],
        size: 1
      }

      const mockAnswerVote = {
        id: 'vote-1',
        ref: { path: 'qa_answer_votes/vote-1' }
      }

      const mockAnswerVotesSnapshot = {
        docs: [mockAnswerVote]
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswersSnapshot) }) }
        }
        if (collectionName === 'qa_answer_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockAnswerVotesSnapshot) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)

      expect(response.status).toBe(200)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockAnswerVote.ref)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockAnswer.ref)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockQuestionRef)
    })

    it('should delete question votes', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      const mockQuestionVote = {
        id: 'q-vote-1',
        ref: { path: 'qa_question_votes/q-vote-1' }
      }

      const mockQuestionVotesSnapshot = {
        docs: [mockQuestionVote]
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue(mockQuestionVotesSnapshot) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)

      expect(response.status).toBe(200)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockQuestionVote.ref)
      expect(mockBatch.delete).toHaveBeenCalledWith(mockQuestionRef)
    })

    it('should commit batch operations', async () => {
      const mockQuestionDoc = {
        exists: true,
        data: () => ({
          title: 'Test Question',
          author: {
            uid: mockSession.uid,
            name: 'Test User'
          }
        })
      }

      const mockQuestionRef = {
        get: jest.fn().mockResolvedValue(mockQuestionDoc),
        delete: jest.fn()
      }

      const mockBatch = {
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(true)
      }

      ;(adminDb.batch as jest.Mock).mockReturnValue(mockBatch)

      const mockCollection = jest.fn((collectionName: string) => {
        if (collectionName === 'qa_questions') {
          return { doc: jest.fn().mockReturnValue(mockQuestionRef) }
        }
        if (collectionName === 'qa_answers') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        if (collectionName === 'qa_question_votes') {
          return { where: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }) }
        }
        return { where: jest.fn() }
      })

      ;(adminDb.collection as jest.Mock).mockImplementation(mockCollection)

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)

      expect(response.status).toBe(200)
      expect(mockBatch.commit).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      ;(getSession as jest.Mock).mockResolvedValue(mockSession)
    })

    it('should return 500 on database error', async () => {
      ;(adminDb.collection as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection failed')
      })

      const request = new NextRequest('http://localhost/api/qa/delete-question', {
        method: 'DELETE',
        body: JSON.stringify({ questionId })
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBeDefined()
    })
  })
})
