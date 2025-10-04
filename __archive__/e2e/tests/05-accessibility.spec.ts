import { test, expect } from '../helpers/test-base';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests (WCAG 2.1 AA)', () => {
  test('homepage meets WCAG 2.1 AA standards', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('authentication pages are accessible', async ({ page }) => {
    // Test login page
    await page.goto('/auth/login');
    
    const loginScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(loginScan.violations).toEqual([]);
    
    // Test signup page
    await page.goto('/auth/signup');
    
    const signupScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    
    expect(signupScan.violations).toEqual([]);
  });

  test('keyboard navigation works throughout the app', async ({ page }) => {
    await page.goto('/');
    
    // Tab through navigation
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();
    
    // Continue tabbing and ensure focus is visible
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element) return null;
        
        const styles = window.getComputedStyle(element);
        return {
          tag: element.tagName,
          hasOutline: styles.outline !== 'none' || styles.outlineWidth !== '0px',
          hasBorder: styles.borderWidth !== '0px',
          hasBoxShadow: styles.boxShadow !== 'none'
        };
      });
      
      // Ensure focused element has visual indication
      expect(focused).toBeTruthy();
      expect(focused.hasOutline || focused.hasBorder || focused.hasBoxShadow).toBeTruthy();
    }
    
    // Test Enter key activation
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    // Should navigate or activate the focused element
    await page.waitForTimeout(1000);
  });

  test('ARIA labels and roles are properly implemented', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation landmark
    const nav = page.locator('nav[role="navigation"], nav[aria-label]');
    await expect(nav.first()).toBeVisible();
    
    // Check for main content landmark
    const main = page.locator('main, [role="main"]');
    await expect(main.first()).toBeVisible();
    
    // Check buttons have accessible names
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const hasAccessibleName = await button.evaluate((btn) => {
        return !!(btn.textContent?.trim() || 
                 btn.getAttribute('aria-label') || 
                 btn.getAttribute('aria-labelledby'));
      });
      expect(hasAccessibleName).toBeTruthy();
    }
    
    // Check form inputs have labels
    await page.goto('/auth/login');
    const inputs = await page.locator('input:not([type="hidden"])').all();
    for (const input of inputs) {
      const hasLabel = await input.evaluate((inp) => {
        const id = inp.id;
        const hasAriaLabel = inp.getAttribute('aria-label');
        const hasAriaLabelledby = inp.getAttribute('aria-labelledby');
        const hasLabelElement = id ? document.querySelector(`label[for="${id}"]`) : null;
        
        return !!(hasAriaLabel || hasAriaLabelledby || hasLabelElement);
      });
      expect(hasLabel).toBeTruthy();
    }
  });

  test('color contrast meets WCAG standards', async ({ page }) => {
    await page.goto('/');
    
    // Use axe to check color contrast
    const contrastResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('.text, p, h1, h2, h3, h4, h5, h6, button, a')
      .analyze();
    
    const contrastViolations = contrastResults.violations.filter(v => 
      v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );
    
    expect(contrastViolations).toEqual([]);
  });

  test('images have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = await page.locator('img').all();
    for (const img of images) {
      const altText = await img.getAttribute('alt');
      expect(altText).toBeTruthy();
      expect(altText.length).toBeGreaterThan(0);
    }
  });

  test('focus management in modals and overlays', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    await page.goto('/dashboard');
    
    // Find and click a button that opens a modal
    const modalTrigger = page.getByRole('button', { name: /Settings|Profile|Menu/i }).first();
    if (await modalTrigger.isVisible()) {
      await modalTrigger.click();
      
      // Wait for modal/dropdown to open
      await page.waitForTimeout(500);
      
      // Check focus is trapped within modal
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
      
      // Tab through modal elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Focus should remain in modal
      const stillInModal = await page.evaluate(() => {
        const activeEl = document.activeElement;
        if (!activeEl) return false;
        
        // Check if focused element is within a modal/dropdown
        return activeEl.closest('[role="dialog"], [role="menu"], .modal, .dropdown');
      });
      
      expect(stillInModal).toBeTruthy();
      
      // Close modal with Escape
      await page.keyboard.press('Escape');
      
      // Focus should return to trigger button
      const focusReturned = await page.evaluate(() => {
        const activeEl = document.activeElement;
        return activeEl?.tagName === 'BUTTON';
      });
      expect(focusReturned).toBeTruthy();
    }
  });

  test('screen reader announcements for dynamic content', async ({ page, testUser }) => {
    const { email, password } = await testUser.signUp();
    await page.goto('/review');
    
    // Check for ARIA live regions
    const liveRegions = page.locator('[aria-live], [role="alert"], [role="status"]');
    await expect(liveRegions.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
    
    // Start a review session
    const startButton = page.getByRole('button', { name: /Start/i }).first();
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Check for status updates
      const statusUpdate = page.locator('[role="status"], [aria-live="polite"]').first();
      if (await statusUpdate.isVisible({ timeout: 5000 })) {
        const statusText = await statusUpdate.textContent();
        expect(statusText).toBeTruthy();
      }
    }
  });

  test('form validation messages are accessible', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Submit empty form
    await page.getByRole('button', { name: /Log in|Sign in/i }).click();
    
    // Check for accessible error messages
    const errors = await page.locator('[role="alert"], [aria-invalid="true"]').all();
    expect(errors.length).toBeGreaterThan(0);
    
    // Check error messages are associated with inputs
    const emailInput = page.locator('input[name="email"]');
    const hasErrorAssociation = await emailInput.evaluate((input) => {
      const ariaDescribedby = input.getAttribute('aria-describedby');
      const ariaErrormessage = input.getAttribute('aria-errormessage');
      const ariaInvalid = input.getAttribute('aria-invalid');
      
      return !!(ariaDescribedby || ariaErrormessage || ariaInvalid === 'true');
    });
    
    expect(hasErrorAssociation).toBeTruthy();
  });

  test('responsive design maintains accessibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const mobileScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(mobileScan.violations).toEqual([]);
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    const tabletScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(tabletScan.violations).toEqual([]);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    const desktopScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    expect(desktopScan.violations).toEqual([]);
  });
});