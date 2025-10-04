import { test, expect } from '../helpers/test-base';

test.describe('User Onboarding Flow', () => {
  test('new user can complete full onboarding', async ({ page }) => {
    // Visit homepage
    await page.goto('/');
    
    // Check landing page elements
    await expect(page.getByRole('heading', { name: /Welcome to Moshimoshi/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Started/i })).toBeVisible();
    
    // Navigate to signup
    await page.click('text=Get Started');
    await expect(page).toHaveURL(/\/auth\/signup/);
    
    // Fill signup form
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'Test123!@#';
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    
    // Accept terms if present
    const termsCheckbox = page.locator('input[type="checkbox"][name="terms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }
    
    // Submit signup
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard or onboarding
    await page.waitForURL(/(dashboard|onboarding|learn)/);
    
    // Check for welcome message or tutorial
    const welcomeText = page.getByText(/Welcome|はじめまして/i);
    await expect(welcomeText.first()).toBeVisible({ timeout: 10000 });
    
    // If onboarding steps exist, complete them
    const nextButton = page.getByRole('button', { name: /Next|次へ/i });
    if (await nextButton.isVisible({ timeout: 5000 })) {
      // Complete onboarding steps
      while (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500); // Small delay for animations
      }
    }
    
    // Verify user lands on main app
    await expect(page).toHaveURL(/(dashboard|learn|home)/);
  });

  test('existing user can login', async ({ page }) => {
    // First create a user
    await page.goto('/auth/signup');
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'Test123!@#';
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    
    const termsCheckbox = page.locator('input[type="checkbox"][name="terms"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }
    
    await page.click('button[type="submit"]');
    await page.waitForURL(/(dashboard|learn|home)/);
    
    // Logout
    const userMenu = page.getByRole('button', { name: /User menu|Profile/i });
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.click('text=Logout');
    } else {
      // Alternative logout method
      await page.goto('/auth/logout');
    }
    
    // Now test login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    
    // Verify successful login
    await page.waitForURL(/(dashboard|learn|home)/);
    await expect(page).not.toHaveURL(/auth/);
  });

  test('password reset flow works', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Click forgot password
    await page.click('text=Forgot password');
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
    
    // Enter email
    const testEmail = `reset${Date.now()}@example.com`;
    await page.fill('input[name="email"]', testEmail);
    await page.click('button[type="submit"]');
    
    // Check for success message
    await expect(page.getByText(/email.*sent|Check your email/i)).toBeVisible();
  });

  test('validates signup form fields', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Check for validation errors
    await expect(page.getByText(/email.*required/i)).toBeVisible();
    await expect(page.getByText(/password.*required/i)).toBeVisible();
    
    // Test invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/valid email/i)).toBeVisible();
    
    // Test weak password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/password.*characters|weak/i)).toBeVisible();
    
    // Test password mismatch
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.fill('input[name="confirmPassword"]', 'Different123!@#');
    await page.click('button[type="submit"]');
    await expect(page.getByText(/passwords.*match/i)).toBeVisible();
  });
});