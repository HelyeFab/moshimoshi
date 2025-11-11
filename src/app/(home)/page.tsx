import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import LandingPageClient from './LandingPageClient'

/**
 * Home Page - Server Component
 *
 * Implements authenticated user redirect pattern:
 * - Unauthenticated users: See landing page (SEO optimized)
 * - Authenticated users: Redirect to dashboard (better UX)
 *
 * This server-side check ensures:
 * 1. No client-side flash (redirect happens before render)
 * 2. SEO preserved (bots always see landing page)
 * 3. Security (server validates session)
 * 4. Performance (authenticated users skip landing page load)
 */
export default async function HomePage() {
  // Check if user is authenticated on the server
  const session = await getSession()

  // If user is logged in, redirect to dashboard
  if (session) {
    console.log(`[HomePage] Authenticated user ${session.uid} redirected to dashboard`)
    redirect('/dashboard')
  }

  // Not authenticated - show landing page
  return <LandingPageClient />
}
