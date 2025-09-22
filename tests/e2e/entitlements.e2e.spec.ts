/**
 * End-to-End Tests for Entitlements System
 * Tests the complete user journey through different subscription tiers
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Entitlements E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
  });

  test.describe('Guest User Journey', () => {
    test('should allow guest to practice hiragana 3 times', async () => {
      // Start as guest
      await page.goto('/practice/hiragana');
      
      // Should see guest limit notice
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('3 practices remaining today');

      // Complete first practice
      await page.click('[data-testid="start-practice"]');
      await completePracticeSession(page);
      
      // Check remaining count
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('2 practices remaining');

      // Complete second practice
      await page.click('[data-testid="start-practice"]');
      await completePracticeSession(page);
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('1 practice remaining');

      // Complete third practice
      await page.click('[data-testid="start-practice"]');
      await completePracticeSession(page);

      // Should now be blocked
      await expect(page.locator('[data-testid="limit-reached-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-prompt"]')).toContainText('Upgrade to continue practicing');
      
      // Start button should be disabled
      await expect(page.locator('[data-testid="start-practice"]')).toBeDisabled();
    });

    test('should show reset timer when limit reached', async () => {
      // Simulate reaching limit
      await page.goto('/practice/hiragana?mock-usage=3');
      
      await expect(page.locator('[data-testid="reset-timer"]')).toBeVisible();
      await expect(page.locator('[data-testid="reset-timer"]')).toContainText(/Resets in \d+h \d+m/);
    });

    test('should track katakana separately from hiragana', async () => {
      // Use up hiragana limit
      await page.goto('/practice/hiragana?mock-usage=3');
      await expect(page.locator('[data-testid="limit-reached-modal"]')).toBeVisible();

      // Katakana should still be available
      await page.goto('/practice/katakana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('3 practices remaining today');
      await expect(page.locator('[data-testid="start-practice"]')).toBeEnabled();
    });
  });

  test.describe('Free User Journey', () => {
    test.beforeEach(async () => {
      // Login as free user
      await loginAsUser(page, 'free@test.com', 'password123');
    });

    test('should allow 5 daily practices for free users', async () => {
      await page.goto('/practice/hiragana');
      
      // Should see free tier limit
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('5 practices remaining today');

      // Complete 5 practices
      for (let i = 5; i > 0; i--) {
        await page.click('[data-testid="start-practice"]');
        await completePracticeSession(page);
        
        if (i > 1) {
          await expect(page.locator('[data-testid="limit-display"]')).toContainText(`${i - 1} practice`);
        }
      }

      // 6th attempt should be blocked
      await expect(page.locator('[data-testid="limit-reached-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-to-premium"]')).toBeVisible();
    });

    test('should persist usage across sessions', async () => {
      await page.goto('/practice/hiragana');
      
      // Complete 2 practices
      for (let i = 0; i < 2; i++) {
        await page.click('[data-testid="start-practice"]');
        await completePracticeSession(page);
      }
      
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('3 practices remaining');

      // Logout and login again
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout"]');
      await loginAsUser(page, 'free@test.com', 'password123');

      // Usage should be remembered
      await page.goto('/practice/hiragana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('3 practices remaining');
    });
  });

  test.describe('Premium User Journey', () => {
    test.beforeEach(async () => {
      // Login as premium user
      await loginAsUser(page, 'premium@test.com', 'password123');
    });

    test('should show unlimited practices for premium users', async () => {
      await page.goto('/practice/hiragana');
      
      // Should show unlimited
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('Unlimited practices');
      await expect(page.locator('[data-testid="premium-badge"]')).toBeVisible();

      // Complete many practices without limit
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="start-practice"]');
        await completePracticeSession(page);
        
        // Should never show limit
        await expect(page.locator('[data-testid="limit-display"]')).toContainText('Unlimited practices');
      }

      // Should never see upgrade prompt
      await expect(page.locator('[data-testid="limit-reached-modal"]')).not.toBeVisible();
    });

    test('should have unlimited access to all features', async () => {
      // Check hiragana
      await page.goto('/practice/hiragana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('Unlimited');

      // Check katakana
      await page.goto('/practice/katakana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('Unlimited');

      // Both should be immediately accessible
      await expect(page.locator('[data-testid="start-practice"]')).toBeEnabled();
    });
  });

  test.describe('Upgrade Flow', () => {
    test('should handle upgrade from guest to free', async () => {
      // Start as guest and hit limit
      await page.goto('/practice/hiragana?mock-usage=3');
      await expect(page.locator('[data-testid="limit-reached-modal"]')).toBeVisible();

      // Click sign up
      await page.click('[data-testid="sign-up-free"]');
      
      // Complete registration
      await page.fill('[data-testid="email"]', 'newuser@test.com');
      await page.fill('[data-testid="password"]', 'password123');
      await page.click('[data-testid="register-button"]');

      // Should be redirected back with free tier limits
      await expect(page).toHaveURL('/practice/hiragana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('5 practices remaining today');
    });

    test('should handle upgrade from free to premium', async () => {
      await loginAsUser(page, 'free@test.com', 'password123');
      
      // Hit free tier limit
      await page.goto('/practice/hiragana?mock-usage=5');
      await expect(page.locator('[data-testid="limit-reached-modal"]')).toBeVisible();

      // Click upgrade to premium
      await page.click('[data-testid="upgrade-to-premium"]');
      
      // Should navigate to pricing page
      await expect(page).toHaveURL('/pricing');
      
      // Select monthly plan
      await page.click('[data-testid="select-monthly-plan"]');
      
      // Complete Stripe checkout (mocked in test environment)
      await completeStripeCheckout(page);

      // Should redirect back with unlimited access
      await expect(page).toHaveURL('/practice/hiragana');
      await expect(page.locator('[data-testid="limit-display"]')).toContainText('Unlimited practices');
      await expect(page.locator('[data-testid="start-practice"]')).toBeEnabled();
    });
  });

  test.describe('Admin Decision Explorer', () => {
    test.beforeEach(async () => {
      await loginAsAdmin(page);
    });

    test('should display decision logs', async () => {
      await page.goto('/admin/decision-explorer');
      
      // Should show decision table
      await expect(page.locator('[data-testid="decision-logs-table"]')).toBeVisible();
      
      // Should have filter options
      await expect(page.locator('[data-testid="filter-user-id"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-feature"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-date-range"]')).toBeVisible();
    });

    test('should filter decisions by user', async () => {
      await page.goto('/admin/decision-explorer');
      
      // Filter by specific user
      await page.fill('[data-testid="filter-user-id"]', 'test-user-123');
      await page.click('[data-testid="apply-filters"]');

      // All rows should be for that user
      const userCells = await page.locator('[data-testid="user-id-cell"]').all();
      for (const cell of userCells) {
        await expect(cell).toContainText('test-user-123');
      }
    });

    test('should show decision details on click', async () => {
      await page.goto('/admin/decision-explorer');
      
      // Click first decision row
      await page.click('[data-testid="decision-row"]:first-child');
      
      // Should show detail modal
      await expect(page.locator('[data-testid="decision-detail-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="decision-context"]')).toBeVisible();
      await expect(page.locator('[data-testid="decision-result"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      await page.goto('/practice/hiragana');
      
      // Simulate offline
      await page.context().setOffline(true);
      
      // Try to start practice
      await page.click('[data-testid="start-practice"]');
      
      // Should show offline message
      await expect(page.locator('[data-testid="offline-notice"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-notice"]')).toContainText('You are offline');
      
      // Restore connection
      await page.context().setOffline(false);
      
      // Should recover
      await page.click('[data-testid="retry-button"]');
      await expect(page.locator('[data-testid="offline-notice"]')).not.toBeVisible();
    });

    test('should handle expired sessions', async () => {
      await loginAsUser(page, 'free@test.com', 'password123');
      
      // Simulate session expiry
      await page.evaluate(() => {
        localStorage.removeItem('auth-token');
      });
      
      // Try to start practice
      await page.goto('/practice/hiragana');
      await page.click('[data-testid="start-practice"]');
      
      // Should redirect to login
      await expect(page).toHaveURL('/login?redirect=/practice/hiragana');
      await expect(page.locator('[data-testid="session-expired-notice"]')).toBeVisible();
    });
  });
});

// Helper functions
async function loginAsUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function loginAsAdmin(page: Page) {
  await loginAsUser(page, 'admin@test.com', 'admin123');
}

async function completePracticeSession(page: Page) {
  // Simulate completing a practice session
  const questions = 5;
  for (let i = 0; i < questions; i++) {
    await page.fill('[data-testid="answer-input"]', 'a');
    await page.click('[data-testid="submit-answer"]');
  }
  await page.click('[data-testid="finish-session"]');
}

async function completeStripeCheckout(page: Page) {
  // In test environment, this would be mocked
  await page.fill('[data-testid="mock-card-number"]', '4242424242424242');
  await page.fill('[data-testid="mock-card-exp"]', '12/25');
  await page.fill('[data-testid="mock-card-cvc"]', '123');
  await page.click('[data-testid="mock-pay-button"]');
  await page.waitForURL(/success/);
}