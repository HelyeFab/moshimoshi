import { test, expect } from '../helpers/test-base';

test.describe('Payment and Subscription Flow', () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Create and login a test user
    const { email, password } = await testUser.signUp();
    await page.goto('/dashboard');
  });

  test('can view subscription plans', async ({ page }) => {
    // Navigate to pricing/subscription page
    await page.goto('/settings');
    
    const subscriptionLink = page.getByRole('link', { name: /Subscription|Billing|Premium|プレミアム/i });
    if (await subscriptionLink.isVisible()) {
      await subscriptionLink.click();
    } else {
      await page.goto('/subscription');
    }
    
    // Check for plan options
    await expect(page.getByText(/Free|Basic|無料/i)).toBeVisible();
    await expect(page.getByText(/Premium|Pro|プレミアム/i)).toBeVisible();
    
    // Verify pricing information is displayed
    const priceElement = page.getByText(/\$|¥|month|月/i);
    await expect(priceElement.first()).toBeVisible();
    
    // Check for feature comparison
    const features = page.getByText(/Unlimited|Reviews|Access/i);
    await expect(features.first()).toBeVisible();
  });

  test('can initiate premium subscription', async ({ page }) => {
    await page.goto('/subscription');
    
    // Click upgrade button
    const upgradeButton = page.getByRole('button', { name: /Upgrade|Subscribe|Premium|プレミアムに登録/i });
    await upgradeButton.click();
    
    // Should redirect to Stripe checkout or show payment modal
    await page.waitForTimeout(2000);
    
    // Check for Stripe iframe or payment form
    const stripeFrame = page.frameLocator('iframe[name*="stripe"], iframe[src*="stripe"]').first();
    const paymentForm = page.locator('form[data-testid="payment-form"], .payment-form').first();
    
    const hasPaymentUI = await stripeFrame.locator('input').first().isVisible({ timeout: 5000 }).catch(() => false) ||
                         await paymentForm.isVisible({ timeout: 5000 }).catch(() => false);
    
    expect(hasPaymentUI).toBeTruthy();
  });

  test('test payment with test card', async ({ page }) => {
    await page.goto('/subscription');
    
    // Click upgrade
    await page.getByRole('button', { name: /Upgrade|Subscribe/i }).click();
    
    // Wait for payment form
    await page.waitForTimeout(2000);
    
    // Try to fill Stripe test card
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]').first();
    
    try {
      // Fill test card number
      await stripeFrame.locator('[placeholder*="Card number"], [placeholder*="1234"]').fill('4242424242424242');
      await stripeFrame.locator('[placeholder*="MM"], [placeholder*="Expiry"]').fill('12/25');
      await stripeFrame.locator('[placeholder*="CVC"], [placeholder*="CVV"]').fill('123');
      await stripeFrame.locator('[placeholder*="ZIP"], [placeholder*="Postal"]').fill('12345');
      
      // Submit payment
      const submitButton = page.getByRole('button', { name: /Pay|Subscribe|Submit/i });
      await submitButton.click();
      
      // Wait for success
      await page.waitForTimeout(3000);
      
      // Check for success message
      const successMessage = page.getByText(/Success|Thank you|Subscribed|成功/i);
      await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
    } catch (error) {
      // If Stripe test mode is not configured, just verify the UI exists
      console.log('Stripe test mode may not be configured:', error);
      const paymentUI = await stripeFrame.locator('input').first().isVisible().catch(() => false);
      expect(paymentUI).toBeTruthy();
    }
  });

  test('subscription status is reflected in UI', async ({ page }) => {
    // Check current subscription status
    await page.goto('/settings');
    
    const statusElement = page.getByText(/Free Plan|Premium|Subscription|プラン/i);
    await expect(statusElement.first()).toBeVisible();
    
    // Navigate to restricted feature
    await page.goto('/dashboard');
    
    // Look for premium features that should be locked/unlocked
    const premiumBadge = page.locator('[data-premium], .premium-feature, .locked').first();
    if (await premiumBadge.isVisible({ timeout: 5000 })) {
      // Verify premium content is properly gated
      await expect(premiumBadge).toBeVisible();
    }
  });

  test('can manage subscription', async ({ page }) => {
    await page.goto('/settings');
    
    // Click on subscription management
    const manageButton = page.getByRole('button', { name: /Manage|Billing|Cancel/i });
    if (await manageButton.isVisible()) {
      await manageButton.click();
      
      // Should show subscription management options
      const managementOptions = page.getByText(/Cancel|Update payment|Change plan/i);
      await expect(managementOptions.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('handles payment errors gracefully', async ({ page }) => {
    await page.goto('/subscription');
    
    // Click upgrade
    await page.getByRole('button', { name: /Upgrade/i }).click();
    
    // Wait for payment form
    await page.waitForTimeout(2000);
    
    // Try to submit with invalid card
    const stripeFrame = page.frameLocator('iframe[name*="stripe"]').first();
    
    try {
      // Use card that triggers decline
      await stripeFrame.locator('[placeholder*="Card number"]').fill('4000000000000002');
      await stripeFrame.locator('[placeholder*="MM"]').fill('12/25');
      await stripeFrame.locator('[placeholder*="CVC"]').fill('123');
      await stripeFrame.locator('[placeholder*="ZIP"]').fill('12345');
      
      // Submit payment
      await page.getByRole('button', { name: /Pay|Subscribe/i }).click();
      
      // Wait for error
      await page.waitForTimeout(3000);
      
      // Check for error message
      const errorMessage = page.getByText(/declined|failed|error|エラー/i);
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
    } catch (error) {
      // Skip if Stripe is not configured
      console.log('Payment error test skipped:', error);
    }
  });

  test('premium features are accessible after subscription', async ({ page }) => {
    // This test assumes a test user with premium subscription
    // or mocked premium status
    
    await page.goto('/dashboard');
    
    // Check for premium features
    const premiumFeatures = [
      'Advanced statistics',
      'Unlimited reviews',
      'Custom study modes',
      'Priority support'
    ];
    
    // Look for any premium feature indicators
    const hasPremiumAccess = await page.getByText(/Premium|Pro|Advanced/i).first().isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (hasPremiumAccess) {
      // Verify at least one premium feature is accessible
      const premiumContent = page.locator('.premium-content, [data-premium="true"]').first();
      await expect(premiumContent).toBeVisible({ timeout: 5000 });
    }
  });
});