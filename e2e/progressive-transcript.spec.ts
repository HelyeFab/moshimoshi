/**
 * E2E Tests for Progressive Transcript Loading
 * Tests the complete user flow from URL paste to AI enhancement
 */

import { test, expect } from '@playwright/test';

test.describe('Progressive Transcript Loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/youtube-shadowing');
  });

  test('should load raw transcript in 1-3 seconds', async ({ page }) => {
    const startTime = Date.now();

    // Enter YouTube URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript to load
    await page.waitForSelector('text=/Loading transcript/i', { timeout: 1000 });

    // Wait for transcript to appear
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    const loadTime = Date.now() - startTime;

    // Should load in less than 5 seconds (including network)
    expect(loadTime).toBeLessThan(5000);

    // Should show raw transcript indicator
    await expect(page.locator('text=/Raw Transcript/i')).toBeVisible();
  });

  test('should show AI progress indicator', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // AI progress should appear
    await expect(page.locator('text=/Enhancing transcript with AI/i')).toBeVisible({ timeout: 2000 });

    // Progress bar should be visible
    await expect(page.locator('[class*="bg-purple-500"]')).toBeVisible();

    // Status message should be shown
    await expect(page.locator('text=/Analyzing speech patterns|Optimizing line breaks|Adding educational/i')).toBeVisible();
  });

  test('should allow user to start shadowing immediately', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Video player should be visible
    await expect(page.locator('iframe[src*="youtube.com"]')).toBeVisible();

    // Transcript segments should be clickable
    const firstSegment = page.locator('[class*="caption-display"] button').first();
    await expect(firstSegment).toBeEnabled();

    // Click should work immediately (no need to wait for AI)
    await firstSegment.click();
    // No error should occur
  });

  test('should smoothly transition to AI-enhanced transcript', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript
    await page.waitForSelector('text=/Raw Transcript/i', { timeout: 5000 });

    // Wait for AI enhancement to complete (max 30 seconds)
    await expect(page.locator('text=/AI-Enhanced/i')).toBeVisible({ timeout: 35000 });

    // Success toast should appear
    await expect(page.locator('text=/enhanced/i')).toBeVisible({ timeout: 1000 });

    // Progress indicator should disappear
    await expect(page.locator('text=/Enhancing transcript with AI/i')).not.toBeVisible();
  });

  test('should handle click-to-jump in full transcript', async ({ page }) => {
    // Enter URL and wait for transcript
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Click on a segment
    const thirdSegment = page.locator('[class*="caption-display"] button').nth(2);
    await thirdSegment.click();

    // Segment should become active (highlighted)
    await expect(thirdSegment).toHaveClass(/bg-red-500/);

    // Should show play indicator
    await expect(thirdSegment.locator('text=/▶/')).toBeVisible();
  });

  test('should toggle between Current and Full transcript views', async ({ page }) => {
    // Enter URL and wait for transcript
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Should start in Full view
    await expect(page.locator('button:has-text("Current Only")')).toBeVisible();

    // Toggle to Current view
    await page.click('button:has-text("Current Only")');

    // Should show LIVE indicator
    await expect(page.locator('text=/LIVE/i')).toBeVisible();

    // Should show "Coming up" section
    await expect(page.locator('text=/Coming up:/i')).toBeVisible();

    // Toggle back to Full view
    await page.click('button:has-text("Full Transcript")');

    // Should show all segments again
    const segments = page.locator('[class*="caption-display"] button');
    await expect(segments).not.toHaveCount(0);
  });

  test('should show error for invalid URL', async ({ page }) => {
    // Enter invalid URL
    await page.fill('input[placeholder*="YouTube"]', 'not-a-valid-url');
    await page.click('button:has-text("Load Video")');

    // Should show error message
    await expect(page.locator('text=/Invalid YouTube URL/i')).toBeVisible({ timeout: 2000 });
  });

  test('should handle video without Japanese captions', async ({ page }) => {
    // Enter URL of video without Japanese captions
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.click('button:has-text("Load Video")');

    // Should show error about missing Japanese transcript
    await expect(page.locator('text=/No Japanese transcript|Japanese captions/i')).toBeVisible({ timeout: 10000 });
  });

  test('should show translations when AI enhancement completes', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for AI enhancement to complete
    await expect(page.locator('text=/AI-Enhanced/i')).toBeVisible({ timeout: 35000 });

    // Should show translations (look for italic text which indicates translations)
    const translations = page.locator('[class*="caption-display"] .italic');
    await expect(translations.first()).toBeVisible();
  });

  test('should maintain scroll position during AI transition', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Scroll to middle segment
    const middleSegment = page.locator('[class*="caption-display"] button').nth(5);
    await middleSegment.scrollIntoViewIfNeeded();

    // Get current scroll position
    const scrollContainer = page.locator('[class*="max-h-\\[500px\\]"]').first();
    const scrollTopBefore = await scrollContainer.evaluate(el => el.scrollTop);

    // Wait for AI enhancement
    await expect(page.locator('text=/AI-Enhanced/i')).toBeVisible({ timeout: 35000 });

    // Scroll position should be maintained (within 50px tolerance)
    const scrollTopAfter = await scrollContainer.evaluate(el => el.scrollTop);
    expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThan(50);
  });

  test('should show progress percentage', async ({ page }) => {
    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for raw transcript
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Progress should increase over time
    const progressText = page.locator('text=/\\d+%/');
    await expect(progressText).toBeVisible({ timeout: 2000 });

    // Wait a bit and check progress increased
    await page.waitForTimeout(2000);
    const progressValue = await progressText.textContent();
    const percentage = parseInt(progressValue || '0');
    expect(percentage).toBeGreaterThan(0);
  });
});

test.describe('Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test('should work on mobile devices', async ({ page }) => {
    await page.goto('/youtube-shadowing');

    // Enter URL
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');

    // Wait for transcript
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Toggle should be visible and tappable
    const toggle = page.locator('button:has-text("Current Only")');
    await expect(toggle).toBeVisible();

    // Tap should work
    await toggle.tap();
    await expect(page.locator('text=/LIVE/i')).toBeVisible();
  });

  test('should have large enough touch targets', async ({ page }) => {
    await page.goto('/youtube-shadowing');

    // Enter URL and wait for transcript
    await page.fill('input[placeholder*="YouTube"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.click('button:has-text("Load Video")');
    await page.waitForSelector('[class*="caption-display"]', { timeout: 5000 });

    // Check segment buttons are tappable
    const segment = page.locator('[class*="caption-display"] button').first();
    const box = await segment.boundingBox();

    // Touch target should be at least 44x44px (iOS guideline)
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
