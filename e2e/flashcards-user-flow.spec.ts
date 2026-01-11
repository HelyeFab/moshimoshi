import { test, expect, type Page } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD

test.use({ baseURL })

async function signIn(page: Page, userEmail: string, userPassword: string) {
  await page.goto('/en/auth/signin')
  await page.getByLabel('Email').fill(userEmail)
  await page.getByLabel('Password').fill(userPassword)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe('Flashcards user flow', () => {
  test('create, edit, study, and delete a deck', async ({ page }) => {
    test.skip(!email || !password, 'E2E_EMAIL/E2E_PASSWORD not set')

    await signIn(page, email!, password!)

    const deckName = `E2E Deck ${Date.now()}`
    const updatedName = `${deckName} Updated`

    await page.goto('/en/flashcards')
    await page.getByTestId('flashcards-create-deck').click()
    await page.getByTestId('flashcards-source-scratch').click()
    await page.getByTestId('flashcards-deck-name').fill(deckName)
    await page.getByTestId('flashcards-next').click()
    await page.getByTestId('flashcards-card-front').fill('Front')
    await page.getByTestId('flashcards-card-back').fill('Back')
    await page.getByTestId('flashcards-add-card').click()
    await page.getByTestId('flashcards-save').click()

    const createdCard = page.locator('[data-testid="flashcards-deck-card"]', { hasText: deckName })
    await expect(createdCard).toBeVisible()

    await createdCard.locator('[data-testid="flashcards-deck-menu"]').click()
    await page.getByRole('button', { name: /edit deck/i }).click()
    await page.getByTestId('flashcards-deck-name').fill(updatedName)
    await page.getByTestId('flashcards-next').click()
    await page.getByTestId('flashcards-save').click()

    const updatedCard = page.locator('[data-testid="flashcards-deck-card"]', { hasText: updatedName })
    await expect(updatedCard).toBeVisible()

    await updatedCard.locator('[data-testid="flashcards-deck-menu"]').click()
    await page.getByRole('button', { name: /start studying/i }).click()
    await page.getByTestId('flashcards-study-mode-all').click()
    await page.getByTestId('flashcards-start-study').click()
    await expect(page.getByLabel('Close')).toBeVisible()
    await page.getByLabel('Close').click()

    await updatedCard.locator('[data-testid="flashcards-deck-menu"]').click()
    await page.getByRole('button', { name: /delete deck/i }).click()
    await page.getByRole('button', { name: /^delete$/i }).click()
    await expect(updatedCard).toHaveCount(0)
  })
})
