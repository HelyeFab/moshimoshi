'use client'

import { usePathname } from 'next/navigation'
import CommandPalette from './CommandPalette'

/**
 * Conditionally renders CommandPalette based on current route.
 * Hides on landing page and auth pages.
 */
export default function ConditionalCommandPalette() {
  const pathname = usePathname()

  // Hide on landing page and auth pages
  const shouldHide =
    pathname === '/' ||
    pathname === '/landing' ||
    pathname.startsWith('/auth/')

  if (shouldHide) {
    return null
  }

  return <CommandPalette />
}

