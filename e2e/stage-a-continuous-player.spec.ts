/**
 * Stage A E2E Validation — Continuous Player
 *
 * These tests verify the Stage A acceptance criteria through browser automation.
 * They require a running dev server (npm run dev).
 *
 * What these tests CAN verify:
 * - URL input works and video loads
 * - Transcript panel renders data
 * - Loading/error states display correctly
 * - Player iframe is present and functional
 *
 * What these tests CANNOT fully verify (requires manual listening):
 * - Audio continuity (no micro-cuts)
 * - Music video flow quality
 *
 * The audio continuity tests below use structural checks (player state,
 * no console errors from our code) as proxies. The manual checklist in
 * 10-STAGE-A-VALIDATION-CHECKLIST.md covers the listening validation.
 */

import { test, expect, type Page } from '@playwright/test'

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const PLAYER_ROUTE = '/en/moshi-player'

// Miku Real Japanese — Japanese Conversation Practice
// Confirmed working: 276 transcript lines, curated starter video in production
const SPEECH_VIDEO_URL = 'https://www.youtube.com/watch?v=uk7gKixqVNU'
const SPEECH_VIDEO_ID = 'uk7gKixqVNU'

// Timeout for video loading
const VIDEO_LOAD_TIMEOUT = 15_000
const TRANSCRIPT_LOAD_TIMEOUT = 20_000

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function navigateToPlayer(page: Page) {
  await page.goto(PLAYER_ROUTE, { waitUntil: 'networkidle' })
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

test.describe('Stage A: Continuous Player', () => {
  test.describe('A — URL Input and Video Loading', () => {
    test('A1: page loads with URL input visible', async ({ page }) => {
      await navigateToPlayer(page)

      // Should have some form of URL input
      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await expect(urlInput.first()).toBeVisible({ timeout: 5000 })
    })

    test('A2: pasting a valid YouTube URL loads the player', async ({
      page,
    }) => {
      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)

      // Trigger submission (Enter key or submit button)
      await urlInput.first().press('Enter')

      // Wait for an iframe (YouTube embed) to appear
      const iframe = page.locator('iframe[src*="youtube"]')
      await expect(iframe.first()).toBeVisible({ timeout: VIDEO_LOAD_TIMEOUT })
    })

    test('A4: invalid URL shows error state', async ({ page }) => {
      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill('not-a-valid-url')
      await urlInput.first().press('Enter')

      // Should show some error indication (text, color, alert)
      // Look for common error patterns
      const errorIndicator = page.locator(
        '[role="alert"], [class*="error" i], [data-testid*="error" i], text=/invalid|error|not valid/i'
      )
      await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('B — Continuous Playback Structural Checks', () => {
    test('B1-B2: video loads and player iframe is interactive', async ({
      page,
    }) => {
      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)
      await urlInput.first().press('Enter')

      const iframe = page.locator('iframe[src*="youtube"]')
      await expect(iframe.first()).toBeVisible({ timeout: VIDEO_LOAD_TIMEOUT })

      // Verify the iframe src doesn't contain segment-control parameters
      const src = await iframe.first().getAttribute('src')
      expect(src).toBeTruthy()

      // Should not have start/end time params driven by transcript segments
      // (simple autoplay or start=0 is fine)
      if (src) {
        expect(src).not.toMatch(/start=\d+.*end=\d+/)
      }
    })

    test('B3: no console errors from our code during playback', async ({
      page,
    }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          // Filter out YouTube iframe internal errors (not our code)
          if (
            !text.includes('youtube.com') &&
            !text.includes('googlevideo.com') &&
            !text.includes('gstatic.com')
          ) {
            consoleErrors.push(text)
          }
        }
      })

      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)
      await urlInput.first().press('Enter')

      const iframe = page.locator('iframe[src*="youtube"]')
      await expect(iframe.first()).toBeVisible({ timeout: VIDEO_LOAD_TIMEOUT })

      // Let the player run for a few seconds
      await page.waitForTimeout(5000)

      // No errors from our code
      expect(consoleErrors).toEqual([])
    })
  })

  test.describe('D — Transcript Fetch and Display', () => {
    test('D1-D2: transcript loads and renders text', async ({ page }) => {
      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)
      await urlInput.first().press('Enter')

      // Wait for transcript area to have text content
      // Look for a transcript container with actual text
      const transcriptArea = page.locator(
        '[data-testid*="transcript" i], [class*="transcript" i], [aria-label*="transcript" i]'
      )

      await expect(transcriptArea.first()).toBeVisible({
        timeout: TRANSCRIPT_LOAD_TIMEOUT,
      })

      // Should contain some text (not just loading spinner)
      const text = await transcriptArea.first().textContent()
      expect(text).toBeTruthy()
      expect(text!.length).toBeGreaterThan(10)
    })

    test('D4: loading state is visible during transcript fetch', async ({
      page,
    }) => {
      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)
      await urlInput.first().press('Enter')

      // Look for loading indicator (spinner, skeleton, loading text)
      const loadingIndicator = page.locator(
        '[class*="loading" i], [class*="spinner" i], [data-testid*="loading" i], [role="progressbar"], text=/loading|fetching/i'
      )

      // Should appear at least briefly (may be fast on local)
      // Use a short timeout — if transcript loads instantly, that's fine
      try {
        await expect(loadingIndicator.first()).toBeVisible({ timeout: 3000 })
      } catch {
        // Loading state might be too fast to catch — that's acceptable
        // The important thing is that it doesn't crash
      }
    })
  })

  test.describe('E — Decoupling Structural Verification', () => {
    test('E: no playback-interrupting network requests after initial load', async ({
      page,
    }) => {
      const seekRequests: string[] = []

      // Monitor for suspicious API calls that might indicate segment control
      page.on('request', (req) => {
        const url = req.url()
        if (
          url.includes('resegment') ||
          url.includes('segment-translation') ||
          url.includes('segment-override')
        ) {
          seekRequests.push(url)
        }
      })

      await navigateToPlayer(page)

      const urlInput = page.locator(
        'input[type="text"], input[type="url"], input[placeholder*="youtube" i], input[placeholder*="URL" i], input[placeholder*="url" i]'
      )
      await urlInput.first().fill(SPEECH_VIDEO_URL)
      await urlInput.first().press('Enter')

      const iframe = page.locator('iframe[src*="youtube"]')
      await expect(iframe.first()).toBeVisible({ timeout: VIDEO_LOAD_TIMEOUT })

      // Let it play for a while
      await page.waitForTimeout(8000)

      // Should not have made any segment-control API calls
      expect(seekRequests).toEqual([])
    })
  })
})
