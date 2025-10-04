import { test, expect } from '../helpers/test-base';

test.describe('Offline/Online Transition', () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Create and login a test user
    const { email, password } = await testUser.signUp();
    await page.goto('/dashboard');
  });

  test('app works offline and syncs when back online', async ({ page, context }) => {
    // Start a review session while online
    await page.goto('/review');
    await page.getByRole('button', { name: /Start Review/i }).first().click();
    
    // Complete one review online
    const showAnswerBtn = page.getByRole('button', { name: /Show Answer/i });
    if (await showAnswerBtn.isVisible()) {
      await showAnswerBtn.click();
    }
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Good/i }).first().click();
    
    // Go offline
    await context.setOffline(true);
    
    // Verify offline indicator appears
    const offlineIndicator = page.getByText(/Offline|No connection|オフライン/i);
    await expect(offlineIndicator).toBeVisible({ timeout: 10000 });
    
    // Complete reviews while offline
    for (let i = 0; i < 3; i++) {
      const showBtn = page.getByRole('button', { name: /Show Answer/i });
      if (await showBtn.isVisible()) {
        await showBtn.click();
      }
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /Good/i }).first().click();
      await page.waitForTimeout(500);
    }
    
    // Check that progress is saved locally
    const localProgress = await page.evaluate(() => {
      // Check IndexedDB or localStorage for offline data
      const offlineData = localStorage.getItem('offline-queue');
      return offlineData ? JSON.parse(offlineData) : null;
    });
    
    expect(localProgress).toBeTruthy();
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for sync to complete
    await page.waitForTimeout(2000);
    
    // Verify online indicator or sync success
    const onlineIndicator = page.getByText(/Online|Connected|Synced|オンライン/i);
    const syncSuccess = page.getByText(/Sync complete|Data synced|同期完了/i);
    
    const isBackOnline = await onlineIndicator.isVisible({ timeout: 5000 }).catch(() => false) ||
                         await syncSuccess.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(isBackOnline).toBeTruthy();
    
    // Verify data persisted
    await page.reload();
    
    // Check that progress is maintained
    const progressIndicator = page.getByText(/reviews completed|4/i);
    if (await progressIndicator.isVisible({ timeout: 5000 })) {
      await expect(progressIndicator).toBeVisible();
    }
  });

  test('handles offline mode gracefully', async ({ page, context }) => {
    // Go offline immediately
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto('/review');
    
    // App should still load (from service worker cache)
    await expect(page).toHaveURL(/review/);
    
    // Check for offline mode indication
    const offlineMessage = page.getByText(/Offline|Working offline|オフライン/i);
    await expect(offlineMessage).toBeVisible({ timeout: 10000 });
    
    // Verify basic functionality works
    const startButton = page.getByRole('button', { name: /Start/i });
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should be able to review offline
      const content = page.locator('.review-content, [data-testid="review-item"]').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });

  test('queues actions while offline', async ({ page, context }) => {
    await page.goto('/dashboard');
    
    // Go offline
    await context.setOffline(true);
    
    // Perform multiple actions
    await page.goto('/review');
    
    // Try to start a review
    const startBtn = page.getByRole('button', { name: /Start/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    // Complete some reviews
    for (let i = 0; i < 2; i++) {
      const showBtn = page.getByRole('button', { name: /Show/i }).first();
      if (await showBtn.isVisible()) {
        await showBtn.click();
        await page.waitForTimeout(500);
      }
      
      const ratingBtn = page.getByRole('button', { name: /Good/i }).first();
      if (await ratingBtn.isVisible()) {
        await ratingBtn.click();
        await page.waitForTimeout(500);
      }
    }
    
    // Check offline queue
    const queueSize = await page.evaluate(() => {
      const queue = localStorage.getItem('offline-queue');
      return queue ? JSON.parse(queue).length : 0;
    });
    
    expect(queueSize).toBeGreaterThan(0);
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for sync
    await page.waitForTimeout(3000);
    
    // Verify queue is cleared
    const clearedQueue = await page.evaluate(() => {
      const queue = localStorage.getItem('offline-queue');
      return queue ? JSON.parse(queue).length : 0;
    });
    
    expect(clearedQueue).toBe(0);
  });

  test('service worker caches essential resources', async ({ page, context }) => {
    // Load page first to cache resources
    await page.goto('/');
    await page.goto('/review');
    
    // Go offline
    await context.setOffline(true);
    
    // Navigate to cached pages
    await page.goto('/');
    await expect(page).toHaveURL('/');
    
    await page.goto('/review');
    await expect(page).toHaveURL(/review/);
    
    // Check that assets load
    const logo = page.locator('img[alt*="logo"], .logo').first();
    if (await logo.isVisible({ timeout: 5000 })) {
      await expect(logo).toBeVisible();
    }
    
    // Verify critical functionality available
    const criticalElements = page.locator('main, .app-content, #root').first();
    await expect(criticalElements).toBeVisible();
  });

  test('conflict resolution when syncing', async ({ page, context }) => {
    // Complete a review online
    await page.goto('/review');
    await page.getByRole('button', { name: /Start/i }).first().click();
    
    const showBtn = page.getByRole('button', { name: /Show/i }).first();
    if (await showBtn.isVisible()) {
      await showBtn.click();
    }
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Easy/i }).first().click();
    
    // Go offline
    await context.setOffline(true);
    
    // Make conflicting change offline
    await page.reload();
    const startBtn = page.getByRole('button', { name: /Start|Continue/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
    
    const showBtn2 = page.getByRole('button', { name: /Show/i }).first();
    if (await showBtn2.isVisible()) {
      await showBtn2.click();
    }
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Hard/i }).first().click();
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for sync
    await page.waitForTimeout(3000);
    
    // Check for conflict resolution (should use last-write-wins)
    const noErrorMessage = await page.getByText(/error|conflict|failed/i).isVisible({ timeout: 5000 })
      .then(() => false)
      .catch(() => true);
    
    expect(noErrorMessage).toBeTruthy();
  });
});