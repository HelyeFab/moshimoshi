/**
 * Integration-style test for checkout session creation with waitlist discount.
 * Mocks Stripe and Firebase helpers to assert the promo code is applied.
 */

import { NextRequest } from 'next/server'
import { POST } from '../route'

const checkoutCreateMock = jest.fn().mockResolvedValue({ url: 'https://checkout.test/session' })
const retrieveCustomerMock = jest.fn().mockRejectedValue(new Error('not found'))
const createCustomerMock = jest.fn().mockResolvedValue({ id: 'cus_test' })

jest.mock('@/lib/stripe/server', () => ({
  getStripe: () => ({
    customers: {
      create: createCustomerMock,
      retrieve: retrieveCustomerMock,
    },
    checkout: {
      sessions: {
        create: checkoutCreateMock,
      },
    },
  }),
}))

jest.mock('@/lib/firebase/admin', () => ({
  auth: {},
  getCustomerIdByUid: jest.fn().mockResolvedValue(null),
  mapUidToCustomer: jest.fn(),
}))

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn().mockResolvedValue({ uid: 'user_123', email: 'test@example.com' }),
}))

jest.mock('@/lib/stripe/discounts', () => ({
  getDiscountEligibility: jest.fn().mockResolvedValue({
    promotionCodeId: 'promo_test',
    source: 'pre_launch_waitlist',
  }),
}))

describe('create-checkout-session route', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_key',
    }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('applies waitlist discount when eligible', async () => {
    const req = new NextRequest('http://localhost/api/stripe/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({
        priceId: 'price_test',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        idempotencyKey: 'idem-123',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.url).toBe('https://checkout.test/session')

    const createCall = checkoutCreateMock.mock.calls[0][0]

    expect(createCall.discounts).toEqual([{ promotion_code: 'promo_test' }])
    expect(createCall.allow_promotion_codes).toBeUndefined()
  })
})
