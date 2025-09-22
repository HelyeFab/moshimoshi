'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { contentProtection } from '@/utils/contentProtection'

interface ContentProtectionProviderProps {
  children: React.ReactNode
}

// Pages where content protection should be DISABLED (for SEO)
const UNPROTECTED_PATHS = [
  '/',              // Landing page - Important for SEO
  '/about',         // About page - Important for SEO  
  '/pricing',       // Pricing page - Important for conversions
  '/blog',          // Blog posts - Important for SEO
  '/privacy',       // Legal pages
  '/terms',         // Legal pages
]

// Pages where content protection should be ENABLED
const PROTECTED_PATHS = [
  '/dashboard',     // User dashboard
  '/lessons',       // Lesson content
  '/practice',      // Practice exercises
  '/account',       // Account pages
  '/admin',         // Admin pages
]

export function ContentProtectionProvider({ children }: ContentProtectionProviderProps) {
  const pathname = usePathname()
  const protectionApplied = useRef(false)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      // Add another frame to be extra safe
      requestAnimationFrame(() => {
        // Check if current path should be protected
        const shouldProtect = pathname ? PROTECTED_PATHS.some(path => pathname.startsWith(path)) : false
        const shouldNotProtect = pathname ? UNPROTECTED_PATHS.some(path => pathname === path) : false

        if (shouldProtect && !shouldNotProtect && !protectionApplied.current) {
          // Enable protection for protected routes
          contentProtection.enable()
          
          // Exclude form inputs and textareas
          contentProtection.excludeElement('input')
          contentProtection.excludeElement('textarea')
          contentProtection.excludeElement('.allow-select') // Custom class for exceptions
          
          protectionApplied.current = true
          console.log(`Content protection enabled for: ${pathname}`)
        } else if (!shouldProtect || shouldNotProtect) {
          // For unprotected pages, we don't enable protection
          // This preserves SEO and user experience for public pages
          console.log(`Content protection not applied to: ${pathname}`)
        }
      })
    })

    return () => {
      cancelAnimationFrame(rafId)
    }
  }, [pathname])

  return <>{children}</>
}