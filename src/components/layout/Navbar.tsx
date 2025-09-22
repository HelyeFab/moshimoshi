'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import MoshimoshiLogo from '@/components/ui/MoshimoshiLogo'
import ThemeToggle from '@/components/ui/ThemeToggle'
import StreakCounter from '@/components/layout/StreakCounter'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useSubscription } from '@/hooks/useSubscription'
import { PremiumBadge } from '@/components/common/PremiumBadge'
import SyncStatusMenuItem from '@/components/sync/SyncStatusMenuItem'
import BuyMeACoffeeButton from '@/components/common/BuyMeACoffeeButton'

interface NavbarProps {
  user?: {
    uid?: string
    email?: string
    displayName?: string | null
    photoURL?: string | null
    isAdmin?: boolean
  }
  showUserMenu?: boolean
  backLink?: {
    href: string
    label: string
  }
}

export default function Navbar({ user, showUserMenu = true, backLink }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { strings } = useI18n()
  const { theme, setTheme } = useTheme()
  const { isPremium } = useSubscription()
  const [showDropdown, setShowDropdown] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Determine if we should show the back to dashboard link
  // Show on all pages except dashboard, home page, and auth pages
  const shouldShowBackToDashboard = !backLink &&
    pathname !== '/' &&
    pathname !== '/dashboard' &&
    !pathname.startsWith('/auth/')

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640) // sm breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' })

      // Clear any guest session data
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('isGuestUser')
        sessionStorage.removeItem('guestSession')
        sessionStorage.removeItem('guest_welcomed')
      }

      router.push('/auth/signin')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleThemeChange = (newTheme: 'light' | 'system' | 'dark') => {
    setTheme(newTheme)
  }

  return (
    <header className="sticky top-0 z-50 bg-soft-white/80 dark:bg-dark-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 transition-all duration-300">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex justify-between items-center">
          {/* Logo with Japanese character */}
          <Link href="/dashboard" className="group flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl group-hover:animate-bounce">
              も
            </div>
            {/* Hide MoshimoshiLogo on mobile, show on desktop */}
            <div className="hidden sm:block">
              <MoshimoshiLogo size="small" animated={true} className="group-hover:scale-105 transition-transform" />
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Streak Counter - only show for authenticated users */}
            {user && user.uid && !isMobile && (
              <StreakCounter variant="compact" size="sm" showLabel={false} userId={user.uid} />
            )}

            {/* Theme Toggle - only show on desktop */}
            {!isMobile && <ThemeToggle />}

            {/* Back Link - Show custom backLink or auto Back to Dashboard */}
            {(backLink || shouldShowBackToDashboard) && (
              <Link
                href={backLink?.href || '/dashboard'}
                className={`${
                  isMobile
                    ? 'flex items-center gap-1 px-2 py-1.5 text-xs'
                    : 'px-4 py-2 text-sm'
                } font-medium bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 transition-all duration-200`}
              >
                {isMobile ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="hidden xs:inline">{strings.common?.back || 'Back'}</span>
                  </>
                ) : (
                  backLink?.label || strings.navigation?.backToDashboard || '← Back to Dashboard'
                )}
              </Link>
            )}

            {/* Sign In Button for non-authenticated users (including guests and no user) */}
            {showUserMenu && !user && (
              <Link
                href="/auth/signin"
                className="px-4 py-2 text-sm font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all duration-200"
              >
                {strings.common?.signIn || 'Sign In'}
              </Link>
            )}

            {/* User Menu - Only show for authenticated users */}
            {showUserMenu && user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                  aria-label="User menu"
                >
                  <div className="relative">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="Profile"
                        className="w-8 h-8 rounded-full ring-2 ring-primary-400 dark:ring-primary-500"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                        {user.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    {isPremium && (
                      <div className="absolute -top-2 -right-2">
                        <PremiumBadge size="xs" />
                      </div>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-soft-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.displayName || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Sync Status */}
                    <SyncStatusMenuItem />
                    
                    {/* Theme Selector - only show on mobile */}
                    {isMobile && (
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{strings.common?.theme || 'Theme'}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleThemeChange('light')}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                              theme === 'light' 
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            }`}
                          >
                            ☀️
                          </button>
                          <button
                            onClick={() => handleThemeChange('system')}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                              theme === 'system' 
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            }`}
                          >
                            💻
                          </button>
                          <button
                            onClick={() => handleThemeChange('dark')}
                            className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                              theme === 'dark' 
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                                : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                            }`}
                          >
                            🌙
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Menu Items */}
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        {strings.navigation?.dashboard || 'Dashboard'}
                      </div>
                    </Link>

                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {strings.navigation?.account || 'Account'}
                      </div>
                    </Link>
                    
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {strings.navigation?.settings || 'Settings'}
                      </div>
                    </Link>
                    
                    {/* Admin Link (if admin) */}
                    {user?.isAdmin === true && (
                      <Link
                        href="/admin"
                        className="block px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {strings.navigation?.adminDashboard || 'Admin Dashboard'}
                        </div>
                      </Link>
                    )}

                    {/* Buy Me a Coffee Button */}
                    <div className="border-t border-gray-200 dark:border-dark-700">
                      <BuyMeACoffeeButton variant="inline" />
                    </div>

                    <div className="border-t border-gray-200 dark:border-dark-700 pt-2">
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          {strings.common?.signOut || 'Sign Out'}
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}