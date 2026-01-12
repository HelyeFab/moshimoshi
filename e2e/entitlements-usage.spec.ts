import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

type PlanId = 'guest' | 'free' | 'premium_monthly' | 'premium_yearly'

const freeEmail = process.env.E2E_FREE_EMAIL
const freePassword = process.env.E2E_FREE_PASSWORD
const premiumEmail = process.env.E2E_PREMIUM_EMAIL
const premiumPassword = process.env.E2E_PREMIUM_PASSWORD

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

function loadLimits() {
  const configPath = path.resolve(__dirname, '..', 'config', 'features.v1.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as {
    features: Array<{ id: string }>
    limits: Record<PlanId, { daily: Record<string, number>; monthly: Record<string, number> }>
  }
  const featureIds = parsed.features.map(feature => feature.id)
  return { featureIds, limits: parsed.limits }
}

function getLimitForPlan(
  plan: PlanId,
  featureId: string,
  limits: Record<PlanId, { daily: Record<string, number>; monthly: Record<string, number> }>
) {
  const planLimits = limits[plan]
  if (!planLimits) return undefined
  if (featureId in planLimits.daily) return planLimits.daily[featureId]
  if (featureId in planLimits.monthly) return planLimits.monthly[featureId]
  return undefined
}

async function assertUsageChecks(page: Page, expectedPlan: PlanId | 'premium') {
  const { featureIds, limits } = loadLimits()
  let resolvedPlan: PlanId | null = null

  for (const featureId of featureIds) {
    const response = await page.request.get(`/api/usage/${featureId}/check`)
    if (!response.ok()) {
      const body = await response.text().catch(() => '<unreadable>')
      throw new Error(
        `Usage check failed for ${featureId} (status ${response.status()}): ${body}`
      )
    }
    const data = await response.json()

    if (!resolvedPlan) {
      if (expectedPlan === 'premium') {
        const isPremium = data.plan === 'premium_monthly' || data.plan === 'premium_yearly'
        expect(isPremium, `Plan mismatch for ${featureId} (expected premium)`).toBe(true)
      } else {
        expect(
          data.plan,
          `Plan mismatch for ${featureId} (expected ${expectedPlan})`
        ).toBe(expectedPlan)
      }
      resolvedPlan = data.plan as PlanId
    }

    const expectedLimit = getLimitForPlan(resolvedPlan, featureId, limits)
    expect(
      data.limit,
      `Limit mismatch for ${featureId} (expected ${expectedLimit})`
    ).toBe(expectedLimit)

    if (expectedLimit === -1) {
      expect(
        data.allow,
        `Expected allow=true for unlimited feature ${featureId}`
      ).toBe(true)
    } else if (expectedLimit === 0) {
      expect(
        data.allow,
        `Expected allow=false for zero-limit feature ${featureId}`
      ).toBe(false)
    } else if (typeof expectedLimit === 'number') {
      const expectedAllow = data.currentUsage < expectedLimit
      expect(
        data.allow,
        `Expected allow=${expectedAllow} for ${featureId} with usage ${data.currentUsage} and limit ${expectedLimit}`
      ).toBe(expectedAllow)
    }
  }
}

test.describe('Entitlement usage checks', () => {
  test.describe('free account', () => {
    test.use({ storageState: 'e2e/.auth/free.json' })

    test('free account usage checks match config', async ({ page }) => {
      test.setTimeout(120000)
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')
      await ensureAuthenticated(page)
      await assertUsageChecks(page, 'free')
    })
  })

  test.describe('premium account', () => {
    test.use({ storageState: 'e2e/.auth/premium.json' })

    test('premium account usage checks match config', async ({ page }) => {
      test.setTimeout(120000)
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')
      await ensureAuthenticated(page)
      await assertUsageChecks(page, 'premium')
    })
  })
})
