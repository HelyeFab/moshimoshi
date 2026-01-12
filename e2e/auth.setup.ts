import { test, expect, type Response } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const freeEmail = process.env.E2E_FREE_EMAIL
const freePassword = process.env.E2E_FREE_PASSWORD
const premiumEmail = process.env.E2E_PREMIUM_EMAIL
const premiumPassword = process.env.E2E_PREMIUM_PASSWORD

async function signInAndSave(
  browser: any,
  email: string,
  password: string,
  storagePath: string
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/en/auth/signin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  const signInResponse = page
    .waitForResponse((response: Response) =>
      /\/api\/auth\/(signin|callback\/credentials)/.test(response.url())
    )
    .catch(() => null)
  await page.getByRole('button', { name: /sign in/i }).click()
  const response = await signInResponse
  const signInStatus = response ? response.status() : null
  const authError = page.locator('[role="alert"], .text-red-500, .text-error').first()
  let sessionReady = false
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (page.isClosed()) break
    try {
      const sessionResponse = await page.request.get('/api/auth/session', { timeout: 10000 })
      if (sessionResponse.ok()) {
        const data = (await sessionResponse.json()) as { user?: unknown }
        if (data?.user) {
          sessionReady = true
          break
        }
      }
    } catch {
      // Ignore transient errors while waiting for session to appear.
    }
    await page.waitForTimeout(1500)
  }

  if (!sessionReady) {
    const errorText = await authError.textContent().catch(() => null)
    const safeEmail = email.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const screenshotPath = path.resolve(
      __dirname,
      '..',
      'test-results',
      `auth-setup-${safeEmail}.png`
    )
    if (!page.isClosed()) {
      await page.screenshot({ path: screenshotPath, fullPage: true })
    }
    throw new Error(
      `Auth session never became ready. Sign-in status: ${signInStatus ?? 'none'}. Error: ${errorText ?? 'none'}`
    )
  }
  await context.storageState({ path: storagePath })
  await context.close()
}

test('auth setup', async ({ browser }) => {
  test.skip(!freeEmail || !freePassword || !premiumEmail || !premiumPassword)
  test.setTimeout(180000)

  const authDir = path.resolve(__dirname, '.auth')
  fs.mkdirSync(authDir, { recursive: true })
  const freeStatePath = path.join(authDir, 'free.json')
  const premiumStatePath = path.join(authDir, 'premium.json')
  const hasCachedState = fs.existsSync(freeStatePath) && fs.existsSync(premiumStatePath)
  if (hasCachedState && process.env.E2E_FORCE_REAUTH !== 'true') {
    const hasValidSession = async (storagePath: string) => {
      const context = await browser.newContext({ storageState: storagePath })
      const page = await context.newPage()
      try {
        const response = await page.request.get('/api/auth/session')
        if (!response.ok()) return false
        const data = await response.json()
        return !!data?.user
      } finally {
        await context.close()
      }
    }

    const freeOk = await hasValidSession(freeStatePath)
    const premiumOk = await hasValidSession(premiumStatePath)
    if (freeOk && premiumOk) {
      return
    }
  }

  await signInAndSave(browser, freeEmail!, freePassword!, freeStatePath)
  await signInAndSave(browser, premiumEmail!, premiumPassword!, premiumStatePath)
})
