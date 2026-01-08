import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { onboardingCache } from '@/lib/auth/onboarding-cache'

interface OnboardingLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Onboarding Layout - Server Component
 *
 * Handles onboarding flow access control:
 * - Unauthenticated users: Redirect to signin (can't onboard without account)
 * - Users who completed onboarding: Redirect to dashboard (prevent re-entry)
 * - New users: Allow access to onboarding flow
 *
 * NOTE: The intro tutorial (/intro) is outside this layout so users can review it anytime
 */
export default async function OnboardingLayout({
  children,
  params,
}: OnboardingLayoutProps) {
  // Await params to get the locale
  const { locale } = await params

  // Check if user is authenticated
  const session = await getSession()

  if (!session) {
    // Unauthenticated users can't access onboarding
    // They need to sign up first
    console.log('[OnboardingLayout] No session, redirecting to signin')
    redirect(`/${locale}/auth/signin`)
  }

  // Check if user has already completed onboarding
  const hasCompleted = await onboardingCache.hasCompletedOnboarding(session.uid)

  if (hasCompleted) {
    // User already completed onboarding, redirect to dashboard
    console.log(`[OnboardingLayout] User ${session.uid} already completed onboarding, redirecting to dashboard`)
    redirect(`/${locale}/dashboard`)
  }

  // User is authenticated but hasn't completed onboarding - show the flow
  return <>{children}</>
}
