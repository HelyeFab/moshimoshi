import { test, expect, type Page } from '@playwright/test'

const freeEmail = process.env.E2E_FREE_EMAIL
const freePassword = process.env.E2E_FREE_PASSWORD
const premiumEmail = process.env.E2E_PREMIUM_EMAIL
const premiumPassword = process.env.E2E_PREMIUM_PASSWORD

async function seedEntitlementsSnapshot(page: Page) {
  const response = await page.request.get('/api/entitlements/snapshot')
  expect(response.ok(), 'Expected entitlements snapshot to succeed').toBe(true)
  const data = await response.json()
  const token = data?.token as string | undefined
  if (!token) {
    throw new Error('Missing entitlements snapshot token')
  }
  await page.evaluate((snapshotToken) => {
    localStorage.setItem('entitlementsSnapshot', snapshotToken)
  }, token)
}

async function goOffline(page: Page) {
  await page.context().setOffline(true)
}

async function goOnline(page: Page) {
  await page.context().setOffline(false)
}

async function expectBlockedOffline(page: Page) {
  await page.waitForTimeout(500)
  const url = page.url()
  if (url.includes('/pricing')) return
  const bodyText = await page.locator('body').innerText()
  expect(
    bodyText,
    'Expected access to be blocked when offline'
  ).toMatch(/Feature Unavailable|Daily Limit Reached/i)
}

async function resolveFirstBookId(page: Page) {
  const response = await page.request.get('/api/library/books?limit=1&offset=0')
  if (!response.ok()) {
    return null
  }
  const data = await response.json()
  return data?.books?.[0]?.id ?? null
}

async function resolveFirstComicEpisodeId(page: Page) {
  const response = await page.request.get(
    '/api/comics/episodes?limit=1&offset=0&seriesId=moshi-goes-to-japan'
  )
  if (!response.ok()) {
    return null
  }
  const data = await response.json()
  return data?.episodes?.[0]?.id ?? null
}

async function ensureAuthenticated(page: Page) {
  const response = await page.request.get('/api/auth/session')
  if (!response.ok()) {
    throw new Error(`Session check failed with status ${response.status()}`)
  }
  const data = await response.json()
  if (!data?.user) {
    throw new Error('Auth session missing. Re-run `npx playwright test --project=setup`.')
  }
}

test.describe('Entitlement gating (free vs premium)', () => {
  test.describe('free account', () => {
    test.use({ storageState: 'e2e/.auth/free.json' })

    test('free user is redirected away from flashcards', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/flashcards')
      await page.waitForURL(/\/en\/pricing\?from=flashcards/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=flashcards/)
    })

    test('free user is redirected away from textbook vocabulary', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/textbook-vocabulary')
      await page.waitForURL(/\/en\/pricing\?from=textbook_vocabulary/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=textbook_vocabulary/)
    })

    test('free user is redirected away from comics', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/comics')
      await page.waitForURL(/\/en\/pricing\?from=comics/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=comics/)
    })

    test('free user is redirected away from kanji connection', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection')
      await page.waitForURL(/\/en\/pricing\?from=kanji_connection/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=kanji_connection/)
    })

    test('free user is redirected away from library', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/library')
      await page.waitForURL(/\/en\/pricing\?from=books/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=books/)
    })

    test('free user is redirected away from a library book', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      const bookId = await resolveFirstBookId(page)
      test.skip(!bookId, 'No library books available to validate')

      await page.goto(`/en/library/${bookId}`)
      await page.waitForURL(/\/en\/pricing\?from=books/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=books/)
    })

    test('free user is redirected away from a comics episode', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      const episodeId = await resolveFirstComicEpisodeId(page)
      test.skip(!episodeId, 'No comics episodes available to validate')

      await page.goto(`/en/comics/${episodeId}`)
      await page.waitForURL(/\/en\/pricing\?from=comics/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=comics/)
    })

    test('free user is redirected away from kanji connection families', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/families')
      await page.waitForURL(/\/en\/pricing\?from=kanji_connection/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=kanji_connection/)
    })

    test('free user is redirected away from kanji connection radicals', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/radicals')
      await page.waitForURL(/\/en\/pricing\?from=kanji_connection/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=kanji_connection/)
    })

    test('free user is redirected away from kanji connection visual layout', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/visual-layout')
      await page.waitForURL(/\/en\/pricing\?from=kanji_connection/)
      await expect(page).toHaveURL(/\/en\/pricing\?from=kanji_connection/)
    })
  })

  test.describe('premium account', () => {
    test.use({ storageState: 'e2e/.auth/premium.json' })

    test('premium user can access flashcards', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/flashcards')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/flashcards/)
      const decksResponse = await page.request.get('/api/flashcards/decks')
      expect(decksResponse.ok(), 'Expected /api/flashcards/decks to succeed').toBe(true)
    })

    test('premium user can access textbook vocabulary', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/textbook-vocabulary')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/textbook-vocabulary/)
      await expect(
        page.getByRole('heading', { name: /total collection|total vocabulary/i })
      ).toBeVisible()
    })

    test('premium user can access comics', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/comics')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/comics/)
      const seriesResponse = await page.request.get('/api/comics/series')
      expect(seriesResponse.ok(), 'Expected /api/comics/series to succeed').toBe(true)
    })

    test('premium user can access kanji connection', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/kanji-connection/)
    })

    test('premium user can access library', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/library')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/library/)
      const booksResponse = await page.request.get('/api/library/books?limit=1')
      expect(booksResponse.ok(), 'Expected /api/library/books to succeed').toBe(true)
    })

    test('premium user can access a library book', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      const bookId = await resolveFirstBookId(page)
      test.skip(!bookId, 'No library books available to validate')

      await page.goto(`/en/library/${bookId}`)
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/library\//)
    })

    test('premium user can access a comics episode', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      const episodeId = await resolveFirstComicEpisodeId(page)
      test.skip(!episodeId, 'No comics episodes available to validate')

      await page.goto(`/en/comics/${episodeId}`)
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/comics\//)
    })

    test('premium user can access kanji connection families', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/families')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/kanji-connection\/families/)
    })

    test('premium user can access kanji connection radicals', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/radicals')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/kanji-connection\/radicals/)
    })

    test('premium user can access kanji connection visual layout', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/kanji-connection/visual-layout')
      if (page.url().includes('/pricing')) {
        throw new Error('Premium account appears to be on Free plan (redirected to pricing).')
      }
      await expect(page).toHaveURL(/\/en\/kanji-connection\/visual-layout/)
    })
  })
})

test.describe('Offline entitlement gating', () => {
  test.describe('premium account', () => {
    test.use({ storageState: 'e2e/.auth/premium.json' })

    test('premium user can open key pages offline', async ({ page }) => {
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/dashboard')
      await seedEntitlementsSnapshot(page)

      await page.goto('/en/comics')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/library')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/stories')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/news')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/kanji-connection')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/learn/hiragana')
      await page.waitForLoadState('domcontentloaded')
      await page.goto('/en/learn/katakana')
      await page.waitForLoadState('domcontentloaded')

      await goOffline(page)

      await page.goto('/en/comics')
      await expect(page).toHaveURL(/\/en\/comics/)
      await page.goto('/en/library')
      await expect(page).toHaveURL(/\/en\/library/)
      await page.goto('/en/stories')
      await expect(page).toHaveURL(/\/en\/stories/)
      await page.goto('/en/news')
      await expect(page).toHaveURL(/\/en\/news/)
      await page.goto('/en/kanji-connection')
      await expect(page).toHaveURL(/\/en\/kanji-connection/)
      await page.goto('/en/learn/hiragana')
      await expect(page).toHaveURL(/\/en\/learn\/hiragana/)
      await page.goto('/en/learn/katakana')
      await expect(page).toHaveURL(/\/en\/learn\/katakana/)

      await goOnline(page)
    })
  })

  test.describe('free account', () => {
    test.use({ storageState: 'e2e/.auth/free.json' })

    test('free user is blocked from premium pages offline', async ({ page }) => {
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')

      await ensureAuthenticated(page)
      await page.goto('/en/dashboard')
      await seedEntitlementsSnapshot(page)

      await goOffline(page)

      await page.goto('/en/comics')
      await expectBlockedOffline(page)
      await page.goto('/en/library')
      await expectBlockedOffline(page)
      await page.goto('/en/kanji-connection')
      await expectBlockedOffline(page)

      await goOnline(page)
    })
  })
})
