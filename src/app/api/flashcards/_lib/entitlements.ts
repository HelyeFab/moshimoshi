import { getUserPlan } from '@/lib/entitlements/server'
import type { PlanType } from '@/types/entitlements'

// Shared helper for flashcards premium-only sync routes. Keep this aligned with
// server entitlements plan resolution (`getUserPlan`) so route checks do not
// drift from the generic entitlement APIs.
const FLASHCARDS_PREMIUM_PLANS = new Set<PlanType>(['premium_monthly', 'premium_yearly'])

export async function getFlashcardsUserPlan(uid: string): Promise<PlanType> {
  return getUserPlan(uid)
}

export async function isFlashcardsPremiumUser(uid: string): Promise<boolean> {
  const plan = await getFlashcardsUserPlan(uid)
  return FLASHCARDS_PREMIUM_PLANS.has(plan)
}
