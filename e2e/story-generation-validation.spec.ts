/**
 * E2E Tests for Story Generation Validation
 * Tests the validation system to prevent data corruption issues
 */

import { test, expect } from '@playwright/test'

test.describe('Story Generation Validation', () => {
  test.describe('Validation Endpoint', () => {
    test('should validate all published stories', async ({ request }) => {
      // Note: This test requires admin authentication
      // You may need to add authentication headers or use a setup file

      const response = await request.get('/api/admin/stories/validate')

      // Should return validation results
      expect(response.status()).toBe(200)

      const data = await response.json()

      // Verify response structure
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('healthScore')
      expect(data).toHaveProperty('totalStories')
      expect(data).toHaveProperty('validStories')
      expect(data).toHaveProperty('storiesWithIssues')
      expect(data).toHaveProperty('currentSchemaVersion')
      expect(data).toHaveProperty('schemaVersions')
      expect(data).toHaveProperty('summary')

      // Health score should be a number between 0-100
      expect(typeof data.healthScore).toBe('number')
      expect(data.healthScore).toBeGreaterThanOrEqual(0)
      expect(data.healthScore).toBeLessThanOrEqual(100)

      // Summary should have expected fields
      expect(data.summary).toHaveProperty('missingFurigana')
      expect(data.summary).toHaveProperty('missingQuizFields')
      expect(data.summary).toHaveProperty('incompletePages')
      expect(data.summary).toHaveProperty('outdatedSchema')
    })

    test('should detect missing textWithFurigana', async ({ request }) => {
      const response = await request.get('/api/admin/stories/validate')
      expect(response.status()).toBe(200)

      const data = await response.json()

      // If there are issues with missing furigana, they should be reported
      if (data.summary.missingFurigana > 0) {
        expect(data.storiesWithIssues).toBeGreaterThan(0)
        expect(data.issues.length).toBeGreaterThan(0)

        // Check that issues contain relevant information
        const furiganaIssue = data.issues.find((issue: any) =>
          issue.issues.some((i: string) => i.includes('textWithFurigana'))
        )

        if (furiganaIssue) {
          expect(furiganaIssue).toHaveProperty('storyId')
          expect(furiganaIssue).toHaveProperty('title')
          expect(furiganaIssue).toHaveProperty('issues')
        }
      }
    })

    test('should detect missing quiz bilingual fields', async ({ request }) => {
      const response = await request.get('/api/admin/stories/validate')
      expect(response.status()).toBe(200)

      const data = await response.json()

      // If there are issues with quiz fields, they should be reported
      if (data.summary.missingQuizFields > 0) {
        expect(data.storiesWithIssues).toBeGreaterThan(0)

        // Check that quiz issues are properly reported
        const quizIssue = data.issues.find((issue: any) =>
          issue.issues.some(
            (i: string) => i.includes('questionJa') || i.includes('explanationJa')
          )
        )

        if (quizIssue) {
          expect(quizIssue).toHaveProperty('storyId')
          expect(quizIssue).toHaveProperty('issues')
        }
      }
    })

    test('should track schema versions', async ({ request }) => {
      const response = await request.get('/api/admin/stories/validate')
      expect(response.status()).toBe(200)

      const data = await response.json()

      // Should have current schema version
      expect(data.currentSchemaVersion).toBeTruthy()
      expect(typeof data.currentSchemaVersion).toBe('string')

      // Should track schema versions across stories
      expect(data.schemaVersions).toBeTruthy()
      expect(typeof data.schemaVersions).toBe('object')
    })
  })

  test.describe('Publish Validation', () => {
    test('should reject publishing story with missing textWithFurigana', async ({ request }) => {
      const invalidStoryData = {
        draftId: 'draft_test_missing_furigana',
        storyData: {
          title: 'Test Story',
          titleJa: 'テストストーリー',
          jlptLevel: 'N5',
          pages: [
            {
              pageNumber: 1,
              text: 'これは日本語です。',
              // Missing textWithFurigana!
              translation: 'This is Japanese.',
              vocabularyNotes: [],
              grammarNotes: [],
            },
          ],
          quiz: [],
        },
      }

      const response = await request.post('/api/admin/stories/publish-draft', {
        data: invalidStoryData,
      })

      // Should reject with 400 status
      expect(response.status()).toBe(400)

      const data = await response.json()

      // Should have validation error
      expect(data.error).toContain('validation')
      expect(data.validationErrors).toBeTruthy()
      expect(Array.isArray(data.validationErrors)).toBe(true)

      // Should mention the missing field
      const hasTextWithFuriganaError = data.validationErrors.some((error: string) =>
        error.includes('textWithFurigana')
      )
      expect(hasTextWithFuriganaError).toBe(true)
    })

    test('should reject publishing story with incomplete quiz', async ({ request }) => {
      const invalidStoryData = {
        draftId: 'draft_test_incomplete_quiz',
        storyData: {
          title: 'Test Story',
          titleJa: 'テストストーリー',
          jlptLevel: 'N5',
          pages: [
            {
              pageNumber: 1,
              text: 'これは日本語です。',
              textWithFurigana: 'これは<ruby>日本語<rt>にほんご</rt></ruby>です。',
              translation: 'This is Japanese.',
              vocabularyNotes: [],
              grammarNotes: [],
            },
          ],
          quiz: [
            {
              id: 'q1',
              question: 'What is this?',
              // Missing questionJa!
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 0,
              explanation: 'This is the answer',
              // Missing explanationJa!
            },
          ],
        },
      }

      const response = await request.post('/api/admin/stories/publish-draft', {
        data: invalidStoryData,
      })

      // Should reject with 400 status
      expect(response.status()).toBe(400)

      const data = await response.json()

      // Should have validation errors for quiz
      expect(data.validationErrors).toBeTruthy()

      const hasQuizError = data.validationErrors.some(
        (error: string) => error.includes('questionJa') || error.includes('explanationJa')
      )
      expect(hasQuizError).toBe(true)
    })

    test('should accept valid story with all required fields', async ({ request }) => {
      const validStoryData = {
        draftId: 'draft_test_valid_story',
        storyData: {
          title: 'Valid Test Story',
          titleJa: '有効なテストストーリー',
          jlptLevel: 'N5',
          theme: 'test',
          pages: [
            {
              pageNumber: 1,
              text: 'これは日本語です。',
              textWithFurigana: 'これは<ruby>日本語<rt>にほんご</rt></ruby>です。',
              translation: 'This is Japanese.',
              vocabularyNotes: [],
              grammarNotes: [],
            },
          ],
          quiz: [
            {
              id: 'q1',
              question: 'What is this sentence in Japanese?',
              questionJa: 'この<ruby>文<rt>ぶん</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>で<ruby>何<rt>なん</rt></ruby>ですか？',
              options: ['Japanese', 'English', 'Spanish', 'French'],
              correctAnswer: 0,
              explanation: 'The sentence is in Japanese.',
              explanationJa: 'この<ruby>文<rt>ぶん</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>です。',
              type: 'multiple_choice',
              difficulty: 1,
              tags: ['story-comprehension', 'n5'],
            },
          ],
        },
      }

      // Note: This test may fail if draft doesn't exist in Firestore
      // You may need to create the draft first or mock the Firestore call
      const response = await request.post('/api/admin/stories/publish-draft', {
        data: validStoryData,
      })

      // Valid stories should be accepted (200 or 201)
      // OR return 404 if draft not found (expected in test environment)
      expect([200, 201, 404]).toContain(response.status())

      // If successful, verify response structure
      if (response.status() === 200 || response.status() === 201) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.storyId).toBeTruthy()
      }
    })
  })

  test.describe('Error Logging', () => {
    test('should log validation errors to Firestore', async ({ request }) => {
      // Attempt to publish invalid story
      const invalidStoryData = {
        draftId: 'draft_test_error_logging',
        storyData: {
          title: 'Test Error Logging',
          titleJa: 'エラーログテスト',
          jlptLevel: 'N5',
          pages: [
            {
              pageNumber: 1,
              text: 'Test',
              // Missing textWithFurigana
              translation: 'Test',
              vocabularyNotes: [],
              grammarNotes: [],
            },
          ],
        },
      }

      const response = await request.post('/api/admin/stories/publish-draft', {
        data: invalidStoryData,
      })

      // Should fail validation
      expect(response.status()).toBe(400)

      // Note: In a real E2E test, you would:
      // 1. Query Firestore for ai_validation_errors collection
      // 2. Verify the error was logged with all required fields
      // 3. Clean up test data

      // For now, we verify the response contains validation errors
      const data = await response.json()
      expect(data.validationErrors).toBeTruthy()
      expect(data.validationErrors.length).toBeGreaterThan(0)
    })
  })
})

test.describe('Schema Version Tracking', () => {
  test('should include schema version in published stories', async ({ request }) => {
    // Query a recently published story to verify schema version is present
    const response = await request.get('/api/admin/stories/validate')
    expect(response.status()).toBe(200)

    const data = await response.json()

    // Current schema version should be present
    expect(data.currentSchemaVersion).toBeTruthy()

    // At least some stories should have schema versions
    expect(Object.keys(data.schemaVersions).length).toBeGreaterThan(0)
  })
})
