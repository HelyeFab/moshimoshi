import { adminDb } from '@/lib/firebase/admin'

type EntitlementResult = {
  allowed: boolean
  reason: 'premium' | 'not_premium' | 'error'
}

export async function requireR2Entitlement(session: { uid: string }): Promise<EntitlementResult> {
  if (!adminDb) {
    console.warn('[R2 Entitlement] Admin DB not available, allowing request.')
    return { allowed: true, reason: 'error' }
  }

  try {
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'
    const isPremium =
      userData?.subscription?.status === 'active' &&
      (plan === 'premium_monthly' || plan === 'premium_yearly')

    return {
      allowed: isPremium,
      reason: isPremium ? 'premium' : 'not_premium',
    }
  } catch (error) {
    console.warn('[R2 Entitlement] Failed to verify premium status, allowing request.', error)
    return { allowed: true, reason: 'error' }
  }
}
