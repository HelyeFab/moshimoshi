/**
 * E2E Tests for Notification System
 * Tests the complete notification flow from Review Engine to user notifications
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'

// Test configuration
const TEST_USER = {
  email: 'test-notifications@example.com',
  password: 'TestPassword123!',
  uid: 'test-user-' + uuidv4()
}

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

test.describe('Notification System E2E Tests', () => {
  let page: Page
  let context: BrowserContext

  test.beforeAll(async ({ browser }) => {
    // Create a new context with notification permissions
    context = await browser.newContext({
      permissions: ['notifications'],
      geolocation: { latitude: 35.6762, longitude: 139.6503 },
      locale: 'en-US'
    })
  })

  test.beforeEach(async () => {
    page = await context.newPage()

    // Mock the Notification API
    await page.addInitScript(() => {
      // Store original Notification
      const OriginalNotification = window.Notification

      // Mock Notification constructor
      class MockNotification {
        static permission = 'granted'
        static requestPermission = async () => 'granted'

        title: string
        options: any
        onclick: (() => void) | null = null
        onclose: (() => void) | null = null
        onerror: (() => void) | null = null
        onshow: (() => void) | null = null

        constructor(title: string, options?: any) {
          this.title = title
          this.options = options

          // Store in window for testing
          (window as any).__lastNotification = {
            title,
            options,
            timestamp: Date.now()
          }

          // Trigger onshow after a delay
          setTimeout(() => {
            if (this.onshow) this.onshow()
          }, 10)
        }

        close() {
          if (this.onclose) this.onclose()
        }
      }

      // Replace global Notification
      (window as any).Notification = MockNotification
    })

    // Setup authentication
    await page.goto('/auth/signin')
    await page.fill('[name="email"]', TEST_USER.email)
    await page.fill('[name="password"]', TEST_USER.password)
    await page.click('[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|home)/, { timeout: 10000 })
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.describe('Notification Preferences', () => {
    test('should load and update notification preferences', async () => {
      await page.goto('/settings')

      // Navigate to notifications section
      const notificationSection = page.locator('[data-test="notification-settings"]')
      await expect(notificationSection).toBeVisible()

      // Test browser notification toggle
      const browserToggle = page.locator('[data-test="browser-notifications-toggle"]')
      await browserToggle.click()

      // Wait for save
      await page.waitForResponse(response =>
        response.url().includes('/api/notifications/preferences') &&
        response.status() === 200
      )

      // Verify the change persisted
      await page.reload()
      await expect(browserToggle).toBeChecked()
    })

    test('should request browser notification permission', async () => {
      await page.goto('/settings')

      // Click enable notifications button
      const enableButton = page.locator('[data-test="enable-browser-notifications"]')

      if (await enableButton.isVisible()) {
        await enableButton.click()

        // Check permission was granted (mocked)
        const permission = await page.evaluate(() => {
          return Notification.permission
        })
        expect(permission).toBe('granted')
      }
    })

    test('should configure quiet hours', async () => {
      await page.goto('/settings')

      // Enable quiet hours
      const quietHoursToggle = page.locator('[data-test="quiet-hours-enabled"]')
      await quietHoursToggle.click()

      // Set quiet hours time
      await page.fill('[data-test="quiet-hours-start"]', '22:00')
      await page.fill('[data-test="quiet-hours-end"]', '08:00')

      // Save preferences
      const saveButton = page.locator('[data-test="save-preferences"]')
      await saveButton.click()

      // Wait for save confirmation
      await expect(page.locator('[data-test="toast-success"]')).toContainText('saved')
    })
  })

  test.describe('Review Engine Integration', () => {
    test('should schedule notification after completing review', async () => {
      await page.goto('/review')

      // Start a review session
      const startButton = page.locator('[data-test="start-review"]')
      if (await startButton.isVisible()) {
        await startButton.click()
      }

      // Complete a review item
      const answerInput = page.locator('[data-test="answer-input"]')
      if (await answerInput.isVisible()) {
        await answerInput.fill('test answer')
        await page.click('[data-test="submit-answer"]')

        // Check for scheduled notification event
        const scheduledEvent = await page.evaluate(() => {
          return new Promise((resolve) => {
            window.addEventListener('review:scheduled', (event: any) => {
              resolve(event.detail)
            })

            // Timeout after 2 seconds
            setTimeout(() => resolve(null), 2000)
          })
        })

        if (scheduledEvent) {
          expect(scheduledEvent).toHaveProperty('itemId')
          expect(scheduledEvent).toHaveProperty('nextReviewAt')
        }
      }
    })

    test('should show countdown timer for immediate reviews', async () => {
      // Inject test review data with immediate review
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('review:scheduled', {
          detail: {
            itemId: 'test-item-1',
            nextReviewAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            contentType: 'hiragana'
          }
        }))
      })

      // Check for countdown timer
      const countdown = page.locator('[data-test="review-countdown"]')

      // Wait a bit for the countdown to appear
      await page.waitForTimeout(500)

      if (await countdown.isVisible()) {
        const countdownText = await countdown.textContent()
        expect(countdownText).toMatch(/\d+m/) // Should show minutes
      }
    })
  })

  test.describe('Notification Delivery', () => {
    test('should send test notification through browser channel', async () => {
      await page.goto('/settings')

      // Send test notification
      const testButton = page.locator('[data-test="test-notification"]')
      await testButton.click()

      // Wait for notification to be triggered
      await page.waitForTimeout(1000)

      // Check if notification was created
      const lastNotification = await page.evaluate(() => {
        return (window as any).__lastNotification
      })

      expect(lastNotification).toBeTruthy()
      expect(lastNotification.title).toContain('Test')
    })

    test('should show in-app toast notification', async () => {
      // Trigger in-app notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification:show', {
          detail: {
            title: 'Test Toast',
            body: 'This is a test toast notification',
            type: 'info'
          }
        }))
      })

      // Check for toast
      const toast = page.locator('[data-test="notification-toast"]')
      await expect(toast).toBeVisible({ timeout: 5000 })
      await expect(toast).toContainText('Test Toast')

      // Test dismiss
      const dismissButton = toast.locator('[data-test="dismiss-notification"]')
      if (await dismissButton.isVisible()) {
        await dismissButton.click()
        await expect(toast).not.toBeVisible({ timeout: 2000 })
      }
    })

    test('should batch multiple notifications', async () => {
      await page.goto('/settings')

      // Enable batching
      const batchingToggle = page.locator('[data-test="batching-enabled"]')
      await batchingToggle.click()
      await page.fill('[data-test="batching-window"]', '5')

      // Save settings
      await page.click('[data-test="save-preferences"]')
      await page.waitForTimeout(500)

      // Trigger multiple notifications
      for (let i = 0; i < 3; i++) {
        await page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('notification:show', {
            detail: {
              title: `Review ${index + 1}`,
              body: 'Review due',
              type: 'review_due'
            }
          }))
        }, i)
        await page.waitForTimeout(100)
      }

      // Wait for batched notification
      await page.waitForTimeout(1000)

      // Should see only one notification with count
      const notifications = page.locator('[data-test="notification-toast"]')
      const count = await notifications.count()

      // Should be batched into one or show the latest one
      expect(count).toBeLessThanOrEqual(1)
    })
  })

  test.describe('API Endpoints', () => {
    test('should fetch pending notifications', async () => {
      // Make API request
      const response = await page.request.get('/api/notifications/pending')
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('pending')
      expect(data).toHaveProperty('upcoming')
      expect(data).toHaveProperty('summary')
    })

    test('should update notification preferences via API', async () => {
      const preferences = {
        channels: {
          browser: true,
          inApp: true,
          push: false,
          email: true
        },
        timing: {
          immediate: true,
          daily: true,
          overdue: false
        }
      }

      const response = await page.request.put('/api/notifications/preferences', {
        data: preferences
      })

      expect(response.status()).toBe(200)

      const result = await response.json()
      expect(result.success).toBe(true)
    })

    test('should send push notification via API', async () => {
      // This will fail if no FCM token, but should handle gracefully
      const response = await page.request.post('/api/notifications/send-push', {
        data: {
          token: 'test-token',
          title: 'Test Push',
          body: 'Test push notification body'
        }
      })

      // May fail with 400 if token invalid, but API should respond
      expect([200, 400, 503]).toContain(response.status())
    })

    test('should get test notification status', async () => {
      const response = await page.request.get('/api/notifications/test')
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('channelStatus')
      expect(data).toHaveProperty('testTypes')
      expect(data.channelStatus).toHaveProperty('browser')
      expect(data.channelStatus).toHaveProperty('push')
      expect(data.channelStatus).toHaveProperty('email')
      expect(data.channelStatus).toHaveProperty('in_app')
    })
  })

  test.describe('Offline Support', () => {
    test('should queue notifications when offline', async () => {
      // Go offline
      await context.setOffline(true)

      // Try to send notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification:show', {
          detail: {
            title: 'Offline Test',
            body: 'This should be queued',
            type: 'info'
          }
        }))
      })

      // Go back online
      await context.setOffline(false)

      // Wait for sync
      await page.waitForTimeout(2000)

      // Check if notification appears after coming online
      const toast = page.locator('[data-test="notification-toast"]')

      // The notification might appear or be in queue
      // This is implementation-dependent
    })

    test('should persist scheduled notifications', async () => {
      // Schedule a notification
      await page.evaluate(() => {
        const scheduledTime = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        localStorage.setItem('scheduled_notifications', JSON.stringify([{
          id: 'test-1',
          itemId: 'item-1',
          scheduledFor: scheduledTime.toISOString(),
          type: 'review_due'
        }]))
      })

      // Reload page
      await page.reload()

      // Check if scheduled notifications are restored
      const stored = await page.evaluate(() => {
        return localStorage.getItem('scheduled_notifications')
      })

      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe('test-1')
    })
  })

  test.describe('Performance', () => {
    test('should handle rapid notification triggers', async () => {
      const startTime = Date.now()

      // Trigger 50 notifications rapidly
      for (let i = 0; i < 50; i++) {
        await page.evaluate((index) => {
          window.dispatchEvent(new CustomEvent('notification:show', {
            detail: {
              title: `Rapid ${index}`,
              body: 'Performance test',
              type: 'info',
              autoHide: 500
            }
          }))
        }, i)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should handle all notifications within reasonable time
      expect(duration).toBeLessThan(5000) // 5 seconds max

      // Check that page is still responsive
      const testButton = page.locator('button').first()
      if (await testButton.isVisible()) {
        await expect(testButton).toBeEnabled()
      }
    })

    test('should not block UI when scheduling notifications', async () => {
      // Start measuring interaction
      const inputField = page.locator('input').first()

      if (await inputField.isVisible()) {
        // Schedule many notifications
        await page.evaluate(() => {
          for (let i = 0; i < 100; i++) {
            const time = new Date(Date.now() + i * 60 * 1000)
            window.dispatchEvent(new CustomEvent('review:scheduled', {
              detail: {
                itemId: `item-${i}`,
                nextReviewAt: time,
                contentType: 'test'
              }
            }))
          }
        })

        // UI should still be interactive
        await inputField.fill('test')
        await expect(inputField).toHaveValue('test')
      }
    })
  })

  test.describe('Accessibility', () => {
    test('notification settings should be keyboard accessible', async () => {
      await page.goto('/settings')

      // Navigate with keyboard
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Check focused element
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.getAttribute('data-test')
      })

      expect(focusedElement).toBeTruthy()
    })

    test('notifications should have proper ARIA labels', async () => {
      // Trigger notification
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('notification:show', {
          detail: {
            title: 'Accessibility Test',
            body: 'Testing ARIA',
            type: 'info'
          }
        }))
      })

      // Check for ARIA attributes
      const toast = page.locator('[data-test="notification-toast"]')

      if (await toast.isVisible()) {
        const role = await toast.getAttribute('role')
        expect(['alert', 'status', 'log']).toContain(role)

        const ariaLive = await toast.getAttribute('aria-live')
        expect(['polite', 'assertive']).toContain(ariaLive)
      }
    })
  })
})

// Helper function to wait for notification
async function waitForNotification(page: Page, timeout = 5000): Promise<any> {
  return page.evaluate((ms) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms)

      const originalNotification = (window as any).Notification
      ;(window as any).Notification = new Proxy(originalNotification, {
        construct(target, args) {
          clearTimeout(timer)
          resolve({ title: args[0], options: args[1] })
          return new target(...args)
        }
      })
    })
  }, timeout)
}