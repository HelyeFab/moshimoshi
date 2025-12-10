import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { onboardingCache } from '@/lib/auth/onboarding-cache'

/**
 * Onboarding Layout - Server Component
 *
 * Handles onboarding flow access control:
 * - Unauthenticated users: Redirect to signin (can't onboard without account)
 * - Users who completed onboarding: Redirect to dashboard (prevent re-entry)
 * - New users: Allow access to onboarding flow
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  const session = await getSession()

  if (!session) {
    // Unauthenticated users can't access onboarding
    // They need to sign up first
    console.log('[OnboardingLayout] No session, redirecting to signin')
    redirect('/auth/signin')
  }

  // Check if user has already completed onboarding
  const hasCompleted = await onboardingCache.hasCompletedOnboarding(session.uid)

  if (hasCompleted) {
    // User already completed onboarding, redirect to dashboard
    console.log(`[OnboardingLayout] User ${session.uid} already completed onboarding, redirecting to dashboard`)
    redirect('/dashboard')
  }

  // User is authenticated but hasn't completed onboarding - show the flow
  return <>{children}</>
}
