import { test, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import admin from 'firebase-admin'

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

function ensureAdmin() {
  if (admin.apps.length > 0) return

  const serviceAccountPath =
    process.env.E2E_SERVICE_ACCOUNT_PATH ||
    path.resolve(__dirname, '..', 'moshimoshi-service-account.json')
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'))

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

async function setUsageValue(
  userId: string,
  bucketKey: string,
  featureId: string,
  value: number | null
) {
  ensureAdmin()
  const db = admin.firestore()
  const usageRef = db.collection('users').doc(userId).collection('usage').doc(bucketKey)
  const snapshot = await usageRef.get()
  const previousValue = snapshot.data()?.[featureId]

  if (value === null) {
    await usageRef.set(
      {
        [featureId]: admin.firestore.FieldValue.delete(),
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    )
  } else {
    await usageRef.set(
      {
        [featureId]: value,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  return previousValue ?? null
}

async function resolveUserId(email: string) {
  ensureAdmin()
  const auth = admin.auth()
  const user = await auth.getUserByEmail(email)
  return user.uid
}

async function assertLimitReached(
  page: Page,
  expectedPlan: 'free' | 'premium',
  email: string
) {
  const { featureIds, limits } = loadLimits()
  const userId = await resolveUserId(email)

  for (const featureId of featureIds) {
    const response = await page.request.get(`/api/usage/${featureId}/check`)
    if (!response.ok()) {
      const body = await response.text().catch(() => '<unreadable>')
      throw new Error(
        `Usage check failed for ${featureId} (status ${response.status()}): ${body}`
      )
    }
    const data = await response.json()

    const plan = data.plan as PlanId
    const isPremium = plan === 'premium_monthly' || plan === 'premium_yearly'
    if (expectedPlan === 'premium' && !isPremium) {
      throw new Error(`Expected premium plan but got ${plan}`)
    }
    if (expectedPlan === 'free' && plan !== 'free') {
      throw new Error(`Expected free plan but got ${plan}`)
    }

    const planLimits = limits[plan]
    const featureLimit =
      featureId in planLimits.daily
        ? planLimits.daily[featureId]
        : planLimits.monthly[featureId]

    if (typeof featureLimit !== 'number' || featureLimit <= 0) {
      continue
    }

    const bucketKey = data.bucketKey as string
    const previousValue = await setUsageValue(userId, bucketKey, featureId, featureLimit)
    try {
      const checkAfter = await page.request.get(`/api/usage/${featureId}/check`)
      expect(checkAfter.ok(), `Usage check failed for ${featureId} after update`).toBe(true)
      const updated = await checkAfter.json()

      expect(updated.allow, `Expected limit reached for ${featureId}`).toBe(false)
      expect(updated.remaining, `Expected remaining=0 for ${featureId}`).toBe(0)
      expect(updated.reason, `Expected limit_reached for ${featureId}`).toBe('limit_reached')
    } finally {
      await setUsageValue(userId, bucketKey, featureId, previousValue)
    }
  }
}

test.describe('Entitlement quota exhaustion', () => {
  test.describe('free account', () => {
    test.use({ storageState: 'e2e/.auth/free.json' })

    test('free account is blocked at limit for all limited features', async ({ page }) => {
      test.setTimeout(180000)
      test.skip(!freeEmail || !freePassword, 'E2E_FREE_EMAIL/E2E_FREE_PASSWORD not set')
      await ensureAuthenticated(page)
      await assertLimitReached(page, 'free', freeEmail!)
    })
  })

  test.describe('premium account', () => {
    test.use({ storageState: 'e2e/.auth/premium.json' })

    test('premium account is blocked at limit for limited premium features', async ({ page }) => {
      test.setTimeout(180000)
      test.skip(!premiumEmail || !premiumPassword, 'E2E_PREMIUM_EMAIL/E2E_PREMIUM_PASSWORD not set')
      await ensureAuthenticated(page)
      await assertLimitReached(page, 'premium', premiumEmail!)
    })
  })
})
