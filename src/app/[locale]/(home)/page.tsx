import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSession } from '@/lib/auth/session'
import { onboardingCache } from '@/lib/auth/onboarding-cache'
import { isPreLaunch as getPreLaunchStatus, getLaunchDate } from '@/lib/prelaunch/config'
import { getTranslations } from '@/i18n/server'
import { strings as enStrings } from '@/i18n/locales/en/strings'

// Server Components
import LandingHero from './components/server/LandingHero'
import LandingFeatures from './components/server/LandingFeatures'

// Client Components
import Navigation from './components/client/Navigation'
import AnalyticsTracker from './components/client/AnalyticsTracker'
import PricingComparison from '@/components/landing/PricingComparison'

/**
 * Home Page - Hybrid SSR/CSR Architecture
 *
 * Performance optimizations:
 * - Server-side rendering for hero, features, and static content (fast LCP)
 * - Small client components for interactivity (navigation, carousels)
 * - Lazy-loaded sections below the fold
 * - Analytics tracking deferred to client-side
 *
 * Routing logic:
 * - Unauthenticated users: See landing page (SEO optimized)
 * - Authenticated users who haven't onboarded: Redirect to onboarding
 * - Authenticated users who completed onboarding: Redirect to dashboard
 */
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
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
  const { locale } = await params
  const { strings } = await getTranslations(locale as any)

  // Server-side pre-launch check
  const isPreLaunch = getPreLaunchStatus()
  const launchDate = getLaunchDate()

  // Helper for locale-aware paths (client will use useLocalePath, but we need it server-side too)
  const getLocalePath = (path: string) => `/${locale}${path}`

  // Get landing strings (fallback to English if translation missing)
  const landingStrings = (strings as any).landing || enStrings.landing

  return (
    <>
      {/* Client-Side Navigation (interactive) */}
      <Navigation
        isPreLaunch={isPreLaunch}
        landingStrings={landingStrings}
        locale={locale}
      />

      {/* Analytics Tracker (client-side, non-blocking) */}
      <AnalyticsTracker />

      {/* Hero Section (Server-rendered for fast LCP) */}
      <LandingHero
        isPreLaunch={isPreLaunch}
        launchDate={launchDate}
        landingStrings={landingStrings}
        locale={locale}
        getLocalePath={getLocalePath}
      />

      {/* Features Section (Server-rendered) */}
      <LandingFeatures landingStrings={landingStrings} />

      {/* Pricing Section (Lazy-loaded) */}
      <Suspense fallback={
        <div className="py-16 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      }>
        <PricingComparison />
      </Suspense>

      {/* Footer (Server-rendered) */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="text-gray-400">
            © 2025 Moshimoshi. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
