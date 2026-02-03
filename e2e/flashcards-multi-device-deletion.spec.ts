import { test, expect, type Page, type Browser } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const email = process.env.E2E_PREMIUM_EMAIL
const password = process.env.E2E_PREMIUM_PASSWORD

test.use({ baseURL })

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto('/en/auth/signin', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.getByLabel('Email').fill(userEmail)
  await page.getByRole('textbox', { name: 'Password' }).fill(userPassword)
  const signInResponse = page
    .waitForResponse((response) =>
      /\/api\/auth\/(signin|login|callback\/credentials)/.test(response.url())
    )
    .catch(() => null)
  await page.getByRole('button', { name: /sign in/i }).click()
  await signInResponse

  const authError = page.locator('[role="alert"], .text-red-500, .text-error').first()
  let sessionReady = false
  await page.waitForURL(/\/(dashboard|flashcards)/, { timeout: 60000 }).catch(() => {})
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
    throw new Error(`Auth session never became ready. Error: ${errorText ?? 'none'}. URL: ${page.url()}`)
  }
}

async function seedEntitlementsSnapshot(page: Page) {
  const response = await page.request.get('/api/entitlements/snapshot')
  if (!response.ok()) return
  const data = await response.json()
  const token = data?.token as string | undefined
  if (!token) return
  await page.evaluate((snapshotToken) => {
    localStorage.setItem('entitlementsSnapshot', snapshotToken)
  }, token)
}

async function dismissStorageModal(page: Page) {
  const storageModal = page.getByRole('dialog', { name: /keep flashcards offline/i })
  if (await storageModal.isVisible().catch(() => false)) {
    await storageModal.getByRole('button', { name: /close/i }).click()
  }
}

async function openActionMenu(page: Page) {
  await page.getByLabel('More actions').first().click()
}

async function triggerSync(page: Page) {
  await openActionMenu(page)
  const syncItem = page.getByRole('menuitem', { name: /sync all/i })
  if (await syncItem.isVisible().catch(() => false)) {
    await syncItem.click()
  }
}

async function createDeck(page: Page, deckName: string) {
  await page.goto('/en/flashcards')
  await page.waitForLoadState('domcontentloaded')
  if (page.url().includes('/pricing')) {
    throw new Error('Flashcards access redirected to pricing')
  }
  const heading = page.getByRole('heading', { name: /flashcards/i })
  const createFirst = page.getByRole('button', { name: /create your first deck/i })
  await Promise.race([
    heading.waitFor({ timeout: 60000 }),
    createFirst.waitFor({ timeout: 60000 }),
  ])
  await dismissStorageModal(page)
  const createCard = page.getByTestId('flashcards-create-deck')
  const createEmpty = page.getByRole('button', { name: /create your first deck/i })
  if (await createEmpty.isVisible().catch(() => false)) {
    await createEmpty.click()
  } else {
    await createCard.click()
  }
  await page.getByTestId('flashcards-source-scratch').click()
  await page.getByTestId('flashcards-deck-name').fill(deckName)
  await page.getByTestId('flashcards-next').click()
  await page.getByTestId('flashcards-card-front').fill('Front')
  await page.getByTestId('flashcards-card-back').fill('Back')
  await page.getByTestId('flashcards-add-card').click()
  await page.getByTestId('flashcards-save').click()
}

async function waitForDeckVisible(page: Page, deckName: string) {
  const deckLocator = page
    .locator('[data-testid="flashcards-deck-card"]:visible', { hasText: deckName })
    .first()
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await deckLocator.isVisible().catch(() => false)) {
      return deckLocator
    }
    await page.waitForTimeout(2000)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await dismissStorageModal(page)
  }
  return deckLocator
}

async function waitForDeckInCloud(page: Page, deckName: string): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await page.request.get('/api/flashcards/decks')
    if (response.ok()) {
      const data = await response.json()
      const decks = Array.isArray(data?.decks) ? data.decks : []
      const match = decks.find((deck: { id?: string; name?: string }) => deck?.name === deckName)
      if (match?.id) {
        return match.id
      }
    }
    await page.waitForTimeout(2000)
  }
  return null
}

async function waitForDeckDeletedInCloud(page: Page, deckId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await page.request.get('/api/flashcards/decks')
    if (response.ok()) {
      const data = await response.json()
      const deletedDeckIds = Array.isArray(data?.deletedDeckIds) ? data.deletedDeckIds : []
      if (deletedDeckIds.includes(deckId)) {
        return true
      }
    }
    await page.waitForTimeout(2000)
  }
  return false
}

async function deleteDeckFromCard(page: Page, deckName: string) {
  const deckCard = page
    .locator('[data-testid="flashcards-deck-card"]:visible', { hasText: deckName })
    .first()
  await deckCard.locator('[data-testid="flashcards-deck-menu"]').click()
  await page.getByRole('button', { name: /delete deck/i }).click()
  await page.getByRole('button', { name: /^delete$/i }).click()
  await expect(deckCard).toHaveCount(0)
}

async function newSignedInPage(browser: Browser) {
  const authStatePath = path.resolve(__dirname, '.auth', 'premium.json')
  const storageState = fs.existsSync(authStatePath) ? authStatePath : undefined
  const context = await browser.newContext({ baseURL, storageState })
  const page = await context.newPage()
  const sessionResponse = await page.request.get('/api/auth/session').catch(() => null)
  const hasSession = sessionResponse && sessionResponse.ok() && !!(await sessionResponse.json()).user
  if (!hasSession) {
    await signIn(page, email!, password!)
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedEntitlementsSnapshot(page)
  return { context, page }
}

test.describe('Flashcards multi-device deletion', () => {
  test('deleting on device A removes the deck on device B after sync', async ({ browser }) => {
    test.skip(!email || !password, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')
    test.setTimeout(120000)

    const deviceA = await newSignedInPage(browser)
    const deviceB = await newSignedInPage(browser)

    try {
      const deckName = `E2E Multi-Device Deck ${Date.now()}`

      await createDeck(deviceA.page, deckName)
      const createdOnA = await waitForDeckVisible(deviceA.page, deckName)
      await expect(createdOnA).toBeVisible({ timeout: 10000 })

      await triggerSync(deviceA.page)
      const deckId = await waitForDeckInCloud(deviceA.page, deckName)
      expect(deckId).toBeTruthy()

      await deviceB.page.goto('/en/flashcards')
      await dismissStorageModal(deviceB.page)
      await triggerSync(deviceB.page)
      const deckOnB = await waitForDeckVisible(deviceB.page, deckName)
      await expect(deckOnB).toBeVisible({ timeout: 60000 })

      await deleteDeckFromCard(deviceA.page, deckName)
      if (deckId) {
        const deleted = await waitForDeckDeletedInCloud(deviceA.page, deckId)
        expect(deleted).toBe(true)
      }

      await triggerSync(deviceB.page)
      await expect(deckOnB).toHaveCount(0, { timeout: 60000 })
    } finally {
      await deviceA.context.close().catch(() => {})
      await deviceB.context.close().catch(() => {})
    }
  })
})
