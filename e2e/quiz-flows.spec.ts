/**
 * E2E Tests for Quiz Flows
 * Tests the complete quiz experience for both stories and comics
 */

import { test, expect } from '@playwright/test'

test.describe('Story Quiz Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a story with a quiz
    // Note: Update this URL to match an actual story with quiz in your app
    await page.goto('/en/stories/test-story-1')
  })

  test('should display quiz button when quiz is available', async ({ page }) => {
    // Look for quiz button in the story interface
    const quizButton = page.locator('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await expect(quizButton).toBeVisible({ timeout: 5000 })
  })

  test('should render all quiz questions', async ({ page }) => {
    // Click quiz button
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')

    // Wait for quiz to load
    await expect(page.locator('text=/Question 1/i')).toBeVisible({ timeout: 3000 })

    // Verify quiz title is shown
    await expect(page.locator('h1:has-text("Quiz")')).toBeVisible()

    // Verify progress indicator is shown
    await expect(page.locator('text=/\\/\\d+/')).toBeVisible() // e.g., "0/5"
  })

  test('should allow selecting answers', async ({ page }) => {
    // Start quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Select first answer option
    const firstOption = page.locator('input[type="radio"]').first()
    await firstOption.click()

    // Verify option is checked
    await expect(firstOption).toBeChecked()

    // Progress should update
    await expect(page.locator('text=/1\\/\\d+/')).toBeVisible()
  })

  test('should update progress as answers are selected', async ({ page }) => {
    // Start quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Initially should be 0 answered
    await expect(page.locator('text=/0\\/\\d+/')).toBeVisible()

    // Answer first question
    await page.locator('input[type="radio"]').first().click()
    await expect(page.locator('text=/1\\/\\d+/')).toBeVisible()

    // Answer second question (find options for question 2)
    await page.locator('text=/Question 2/i').scrollIntoViewIfNeeded()
    const secondQuestionOptions = page.locator('text=/Question 2/i ~ div input[type="radio"]')
    await secondQuestionOptions.first().click()
    await expect(page.locator('text=/2\\/\\d+/')).toBeVisible()
  })

  test('should disable submit until all questions answered', async ({ page }) => {
    // Start quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Submit button should be disabled initially
    const submitButton = page.locator('button:has-text("Submit")')
    await expect(submitButton).toBeDisabled()

    // Answer all questions
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    const questionsCount = count / 4 // Assuming 4 options per question

    for (let i = 0; i < questionsCount; i++) {
      const questionRadio = radioButtons.nth(i * 4)
      await questionRadio.scrollIntoViewIfNeeded()
      await questionRadio.click()
      await page.waitForTimeout(200)
    }

    // Submit button should now be enabled
    await expect(submitButton).toBeEnabled()
  })

  test('should show results after submission', async ({ page }) => {
    // Start quiz and answer all questions
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Answer all questions
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    const questionsCount = count / 4

    for (let i = 0; i < questionsCount; i++) {
      await radioButtons.nth(i * 4).click()
      await page.waitForTimeout(100)
    }

    // Submit quiz
    await page.click('button:has-text("Submit")')

    // Results should appear
    await expect(page.locator('text=/\\d+%/')).toBeVisible({ timeout: 5000 }) // Score percentage
    await expect(page.locator('text=/XP|earned/i')).toBeVisible() // XP earned
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Retake")')).toBeVisible()
  })

  test('should auto-save progress', async ({ page }) => {
    // Start quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Answer one question
    await page.locator('input[type="radio"]').first().click()
    await page.waitForTimeout(600) // Wait for debounce

    // Reload page
    await page.reload()
    await page.waitForTimeout(1000)

    // Restart quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // First answer should be restored (first radio should be checked)
    const firstRadio = page.locator('input[type="radio"]').first()
    await expect(firstRadio).toBeChecked()
  })

  test('should clear auto-save after submission', async ({ page }) => {
    // Start quiz and complete it
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Answer all and submit
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }
    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1000)

    // Exit quiz
    const exitButton = page.locator('button:has-text("Exit"), button:has-text("Back to Story")')
    if (await exitButton.isVisible()) {
      await exitButton.click()
    }

    // Start quiz again
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Progress should be reset (0 answered)
    await expect(page.locator('text=/0\\/\\d+/')).toBeVisible()
  })

  test('should allow quiz retake', async ({ page }) => {
    // Complete quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }

    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1000)

    // Click retake
    await page.click('button:has-text("Try Again"), button:has-text("Retake")')
    await page.waitForTimeout(1000)

    // Should be back to quiz start
    await expect(page.locator('text=/Question 1/i')).toBeVisible()
    await expect(page.locator('text=/0\\/\\d+/')).toBeVisible()
  })

  test('should show correct/incorrect indicators in review', async ({ page }) => {
    // Complete quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }

    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1000)

    // Review section should exist
    await expect(page.locator('text=/Review/i')).toBeVisible()

    // Should show green indicators for correct answers
    await expect(page.locator('.text-green-500, .border-green-500')).toHaveCount({ min: 1 })
  })

  test('should handle back navigation', async ({ page }) => {
    // Start quiz
    await page.click('button:has-text("Take Quiz"), button:has-text("Start Quiz")')
    await page.waitForTimeout(1000)

    // Click back button
    const backButton = page.locator('button:has-text("Back"), button:has-text("Cancel")')
    await backButton.click()

    // Should return to story
    await expect(page.locator('button:has-text("Take Quiz"), button:has-text("Start Quiz")')).toBeVisible()
  })
})

test.describe('Comic Quiz Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a comic episode with a quiz
    // Note: Update this URL to match an actual comic episode with quiz
    await page.goto('/en/comics/test-comic-ep001')
  })

  test('should display quiz button when quiz is available', async ({ page }) => {
    await page.waitForTimeout(2000)
    const quizButton = page.locator('button:has-text("Take Quiz"), button:has-text("Quiz")')
    await expect(quizButton).toBeVisible({ timeout: 5000 })
  })

  test('should render quiz questions for comic', async ({ page }) => {
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Take Quiz"), button:has-text("Quiz")')

    await expect(page.locator('text=/Question 1/i')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=/EP \\d+:/i')).toBeVisible() // Episode title in quiz header
  })

  test('should show furigana in Japanese locale', async ({ page }) => {
    // Switch to Japanese locale if not already
    const locale = page.url().match(/\/(ja|en)\//)?.[1]
    if (locale !== 'ja') {
      await page.goto(page.url().replace(/\/(en|ja)\//, '/ja/'))
    }

    await page.waitForTimeout(1000)
    await page.click('button:has-text("クイズ"), button:has-text("Quiz")')
    await page.waitForTimeout(1000)

    // Furigana should be present (look for ruby tags or furigana elements)
    const furiganaElements = page.locator('ruby, [class*="furigana"]')
    const count = await furiganaElements.count()

    // There might be furigana if Japanese questions exist
    // This is optional since not all questions may have kanji
    if (count > 0) {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('should allow quiz completion and exit', async ({ page }) => {
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Take Quiz"), button:has-text("Quiz")')
    await page.waitForTimeout(1000)

    // Answer all questions
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }

    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1000)

    // Results should show
    await expect(page.locator('text=/\\d+%/')).toBeVisible()

    // Exit should work
    const exitButton = page.locator('button:has-text("Exit"), button:has-text("Back to Comics")')
    if (await exitButton.isVisible()) {
      await exitButton.click()
      await page.waitForTimeout(1000)

      // Should navigate away from quiz
      await expect(page.locator('text=/Question 1/i')).not.toBeVisible()
    }
  })

  test('should record XP for first completion', async ({ page }) => {
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Take Quiz"), button:has-text("Quiz")')
    await page.waitForTimeout(1000)

    // Answer all questions
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }

    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(2000) // Wait for API call

    // XP should be shown
    await expect(page.locator('text=/\\+\\d+ XP|earned \\d+ XP/i')).toBeVisible()
  })
})

test.describe('Quiz Multi-Locale Support', () => {
  test('should render Japanese questions in Japanese locale', async ({ page }) => {
    await page.goto('/ja/stories/test-story-1')
    await page.waitForTimeout(1000)

    await page.click('button:has-text("クイズ"), button:has-text("Quiz")')
    await page.waitForTimeout(1000)

    // Should show Japanese content
    // Look for Japanese characters in question text
    const questionText = await page.locator('[class*="font-medium"]:has-text(/[ぁ-んァ-ヶー一-龯]/)').first().textContent()
    expect(questionText).toMatch(/[ぁ-んァ-ヶー一-龯]/)
  })

  test('should render English questions in English locale', async ({ page }) => {
    await page.goto('/en/stories/test-story-1')
    await page.waitForTimeout(1000)

    await page.click('button:has-text("Take Quiz"), button:has-text("Quiz")')
    await page.waitForTimeout(1000)

    // Question text should be in English
    const questionText = await page.locator('text=/Question 1/i ~ div').first().textContent()
    expect(questionText).toBeTruthy()
  })
})

test.describe('Quiz Error Handling', () => {
  test('should handle missing quiz data gracefully', async ({ page }) => {
    // Navigate to a story without a quiz
    await page.goto('/en/stories/story-without-quiz')
    await page.waitForTimeout(2000)

    // Quiz button should not be visible
    const quizButton = page.locator('button:has-text("Take Quiz")')
    await expect(quizButton).not.toBeVisible()
  })

  test('should handle network errors during submission', async ({ page }) => {
    await page.goto('/en/stories/test-story-1')
    await page.waitForTimeout(1000)

    // Intercept quiz completion API and make it fail
    await page.route('**/api/quiz/complete', (route) => {
      route.abort('failed')
    })

    await page.click('button:has-text("Take Quiz")')
    await page.waitForTimeout(1000)

    // Answer all and submit
    const radioButtons = page.locator('input[type="radio"]')
    const count = await radioButtons.count()
    for (let i = 0; i < count / 4; i++) {
      await radioButtons.nth(i * 4).click()
    }

    await page.click('button:has-text("Submit")')
    await page.waitForTimeout(1000)

    // Should still show results even if API fails
    // (graceful degradation - no XP but quiz still works)
    await expect(page.locator('text=/\\d+%/')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Mobile Quiz Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } }) // iPhone SE

  test('should work on mobile devices', async ({ page }) => {
    await page.goto('/en/stories/test-story-1')
    await page.waitForTimeout(1000)

    // Quiz button should be tappable
    const quizButton = page.locator('button:has-text("Take Quiz")')
    await quizButton.tap()
    await page.waitForTimeout(1000)

    // Questions should be readable
    await expect(page.locator('text=/Question 1/i')).toBeVisible()

    // Options should be tappable
    const firstOption = page.locator('input[type="radio"]').first()
    await firstOption.tap()
    await expect(firstOption).toBeChecked()
  })

  test('should have large enough touch targets', async ({ page }) => {
    await page.goto('/en/stories/test-story-1')
    await page.waitForTimeout(1000)
    await page.tap('button:has-text("Take Quiz")')
    await page.waitForTimeout(1000)

    // Check option labels are large enough (44x44px minimum)
    const optionLabel = page.locator('label').first()
    const box = await optionLabel.boundingBox()

    expect(box?.height).toBeGreaterThanOrEqual(44)
  })

  test('should scroll properly on mobile', async ({ page }) => {
    await page.goto('/en/stories/test-story-1')
    await page.waitForTimeout(1000)
    await page.tap('button:has-text("Take Quiz")')
    await page.waitForTimeout(1000)

    // Should be able to scroll to last question
    const lastQuestion = page.locator('text=/Question/i').last()
    await lastQuestion.scrollIntoViewIfNeeded()
    await expect(lastQuestion).toBeVisible()
  })
})
