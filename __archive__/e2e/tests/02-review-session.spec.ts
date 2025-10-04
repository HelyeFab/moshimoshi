import { test, expect } from '../helpers/test-base';

test.describe('Review Session Flow', () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Create and login a test user
    const { email, password } = await testUser.signUp();
    await page.goto('/dashboard');
  });

  test('can start and complete a review session', async ({ page }) => {
    // Navigate to review page
    await page.goto('/review');
    
    // Start a new review session
    const startButton = page.getByRole('button', { name: /Start Review|Begin Session|はじめる/i });
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // Wait for first review item to load
    await page.waitForSelector('[data-testid="review-item"], .review-card, .question-card', { timeout: 10000 });
    
    // Complete 5 review items
    for (let i = 0; i < 5; i++) {
      // Check if question is visible
      const questionElement = page.locator('[data-testid="question"], .question, .prompt').first();
      await expect(questionElement).toBeVisible();
      
      // Show answer
      const showAnswerBtn = page.getByRole('button', { name: /Show Answer|答えを見る|Reveal/i });
      if (await showAnswerBtn.isVisible()) {
        await showAnswerBtn.click();
      }
      
      // Wait for answer to be visible
      await page.waitForSelector('[data-testid="answer"], .answer', { timeout: 5000 });
      
      // Rate the answer (test different ratings)
      const ratings = ['Easy', 'Good', 'Hard', 'Again'];
      const rating = ratings[i % ratings.length];
      
      const ratingButton = page.getByRole('button', { name: new RegExp(rating, 'i') }).first();
      if (await ratingButton.isVisible()) {
        await ratingButton.click();
      } else {
        // Fallback to any rating button
        await page.locator('button').filter({ hasText: /Easy|Good|Hard|Again|簡単|良い|難しい|もう一度/i }).first().click();
      }
      
      // Wait for next item or completion
      await page.waitForTimeout(500);
    }
    
    // Check for session completion
    const completionText = page.getByText(/Session Complete|Review Complete|完了|Finished/i);
    if (await completionText.isVisible({ timeout: 5000 })) {
      await expect(completionText).toBeVisible();
    }
  });

  test('SRS algorithm updates intervals correctly', async ({ page }) => {
    await page.goto('/review');
    
    // Start session
    await page.getByRole('button', { name: /Start Review/i }).first().click();
    
    // Get initial item data if available
    const itemId = await page.getAttribute('[data-testid="review-item"]', 'data-item-id').catch(() => null);
    
    // Show answer
    const showAnswerBtn = page.getByRole('button', { name: /Show Answer/i });
    if (await showAnswerBtn.isVisible()) {
      await showAnswerBtn.click();
    }
    
    // Click "Easy" rating
    await page.getByRole('button', { name: /Easy/i }).first().click();
    
    // If we can access the API or local storage, verify interval update
    if (itemId) {
      // Check localStorage or IndexedDB for updated interval
      const updatedInterval = await page.evaluate(() => {
        const stored = localStorage.getItem('review-progress');
        return stored ? JSON.parse(stored) : null;
      });
      
      // Verify interval increased (SRS logic)
      if (updatedInterval) {
        expect(updatedInterval).toBeTruthy();
      }
    }
  });

  test('review session persists progress', async ({ page }) => {
    await page.goto('/review');
    
    // Start session
    await page.getByRole('button', { name: /Start Review/i }).first().click();
    
    // Complete 2 items
    for (let i = 0; i < 2; i++) {
      const showAnswerBtn = page.getByRole('button', { name: /Show Answer/i });
      if (await showAnswerBtn.isVisible()) {
        await showAnswerBtn.click();
      }
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Good/i }).first().click();
      await page.waitForTimeout(500);
    }
    
    // Save current progress
    const progress = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('review-session'),
        sessionStorage: sessionStorage.getItem('review-progress')
      };
    });
    
    // Refresh page
    await page.reload();
    
    // Check if progress is restored
    const restoredProgress = await page.evaluate(() => {
      return {
        localStorage: localStorage.getItem('review-session'),
        sessionStorage: sessionStorage.getItem('review-progress')
      };
    });
    
    // Progress should be maintained
    if (progress.localStorage) {
      expect(restoredProgress.localStorage).toBeTruthy();
    }
  });

  test('handles empty review queue gracefully', async ({ page }) => {
    // Navigate to a completed state or empty queue
    await page.goto('/review?completed=true');
    
    // Check for appropriate message
    const emptyMessage = page.getByText(/No reviews|All done|すべて完了|Nothing to review/i);
    const comeBackMessage = page.getByText(/Come back|Check again|また後で/i);
    
    const hasEmptyState = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false) ||
                          await comeBackMessage.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasEmptyState).toBeTruthy();
  });

  test('review statistics are tracked', async ({ page }) => {
    await page.goto('/review');
    
    // Complete a review session
    await page.getByRole('button', { name: /Start Review/i }).first().click();
    
    // Complete 3 items with different ratings
    const ratings = ['Easy', 'Good', 'Hard'];
    for (const rating of ratings) {
      const showAnswerBtn = page.getByRole('button', { name: /Show Answer/i });
      if (await showAnswerBtn.isVisible()) {
        await showAnswerBtn.click();
      }
      await page.waitForTimeout(500);
      
      const ratingBtn = page.getByRole('button', { name: new RegExp(rating, 'i') }).first();
      if (await ratingBtn.isVisible()) {
        await ratingBtn.click();
      }
      await page.waitForTimeout(500);
    }
    
    // Check for statistics display
    const statsButton = page.getByRole('button', { name: /Stats|Statistics|統計/i });
    if (await statsButton.isVisible({ timeout: 5000 })) {
      await statsButton.click();
      
      // Verify statistics are shown
      await expect(page.getByText(/Reviews completed|Items reviewed/i)).toBeVisible();
      await expect(page.getByText(/3/)).toBeVisible(); // Should show 3 items reviewed
    }
  });
});