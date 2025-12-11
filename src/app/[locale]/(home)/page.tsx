import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { onboardingCache } from '@/lib/auth/onboarding-cache'
import LandingPageClient from './LandingPageClient'

/**
 * Home Page - Server Component
 *
 * Implements authenticated user redirect pattern:
 * - Unauthenticated users: See landing page (SEO optimized)
 * - Authenticated users who haven't onboarded: Redirect to onboarding
 * - Authenticated users who completed onboarding: Redirect to dashboard
 *
 * This server-side check ensures:
 * 1. No client-side flash (redirect happens before render)
 * 2. SEO preserved (bots always see landing page)
 * 3. Security (server validates session)
 * 4. Performance (authenticated users skip landing page load)
 * 5. Onboarding enforcement (new users complete setup first)
 */
export default async function HomePage() {
  // Check if user is authenticated on the server
  const session = await getSession()

  if (session) {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = await onboardingCache.hasCompletedOnboarding(session.uid)

    if (!hasCompletedOnboarding) {
      // New user - send to onboarding flow
      console.log(`[HomePage] User ${session.uid} hasn't completed onboarding, redirecting`)
      redirect('/onboarding')
    }

    // User completed onboarding - send to dashboard
    console.log(`[HomePage] Authenticated user ${session.uid} redirected to dashboard`)
    redirect('/dashboard')
  }

  // Not authenticated - show landing page
  return <LandingPageClient />
}
