'use client'

import { usePathname } from 'next/navigation'
import CommandPalette from './CommandPalette'

/**
 * Conditionally renders CommandPalette based on current route.
 * Hides on landing page, auth pages, and admin pages.
 */
export default function ConditionalCommandPalette() {
  const pathname = usePathname()

  // Hide on landing page, auth pages, and admin pages (admin has its own navigation)
  const shouldHide =
    pathname === '/' ||
    pathname === '/landing' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/admin')

  if (shouldHide) {
    return null
  }

  return <CommandPalette />
}

