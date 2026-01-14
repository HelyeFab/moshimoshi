'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiHome5Line,
  RiHome5Fill,
  RiStackLine,
  RiStackFill,
  RiSearchLine,
  RiSearchFill,
  RiUser3Line,
  RiUser3Fill,
  RiSettings4Line,
  RiSettings4Fill,
  RiLinksLine, // Kanji Connections
  RiLinksFill, // Kanji Connections
  RiLayoutMasonryLine, // Mood Boards
  RiLayoutMasonryFill, // Mood Boards
  RiSpeedUpLine, // Drill
  RiSpeedUpFill, // Drill
  RiYoutubeLine, // Youtube Shadowing
  RiYoutubeFill, // Youtube Shadowing
  RiNewspaperLine, // News
  RiNewspaperFill, // News
  RiBook2Line, // Library
  RiBook2Fill, // Library
  RiBookReadLine, // Story
  RiBookReadFill, // Story
} from 'react-icons/ri'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { useKeyboardVisible, useIsIOSStandalone } from '@/hooks/useMediaQuery'
import { BOTTOM_NAV_HEIGHT, BOTTOM_NAV_HEIGHT_IOS_STANDALONE, SAFE_AREA_FALLBACK } from '@/lib/constants/layout'
import NavHandle from './NavHandle'

export interface NavItem {
  id: string
  label: string
  href?: string
  icon: React.ElementType
  activeIcon: React.ElementType
  matchPaths?: string[]
  action?: () => void
}

const createNavItems = (onSearchClick: () => void, strings: any): NavItem[] => [
  {
    id: 'search',
    label: strings.dashboard?.navigation?.bottomNav?.places || 'Places',
    icon: RiSearchLine,
    activeIcon: RiSearchFill,
    action: onSearchClick,
    matchPaths: [],
  },
  {
    id: 'dashboard',
    label: strings.dashboard?.navigation?.bottomNav?.home || 'Home',
    href: '/dashboard',
    icon: RiHome5Line,
    activeIcon: RiHome5Fill,
    matchPaths: ['/dashboard', '/'],
  },
  {
    id: 'kanji-browser',
    label: strings.dashboard?.navigation?.bottomNav?.kanji || 'Kanji',
    href: '/kanji-browser',
    icon: RiLinksLine,
    activeIcon: RiLinksFill,
    matchPaths: ['/kanji-browser'],
  },
  {
    id: 'mood-boards',
    label: strings.dashboard?.navigation?.bottomNav?.moodBoards || 'Boards',
    href: '/kanji-moods',
    icon: RiLayoutMasonryLine,
    activeIcon: RiLayoutMasonryFill,
    matchPaths: ['/kanji-moods'],
  },
  {
    id: 'drill',
    label: strings.dashboard?.navigation?.bottomNav?.drill || 'Drill',
    href: '/drill',
    icon: RiSpeedUpLine,
    activeIcon: RiSpeedUpFill,
    matchPaths: ['/drill'],
  },
  {
    id: 'youtube-shadowing',
    label: strings.dashboard?.navigation?.bottomNav?.youtubeShadowing || 'Shadow',
    href: '/youtube-shadowing',
    icon: RiYoutubeLine,
    activeIcon: RiYoutubeFill,
    matchPaths: ['/youtube-shadowing'],
  },
  {
    id: 'news',
    label: strings.dashboard?.navigation?.bottomNav?.news || 'News',
    href: '/news',
    icon: RiNewspaperLine,
    activeIcon: RiNewspaperFill,
    matchPaths: ['/news'],
  },
  {
    id: 'library',
    label: strings.dashboard?.navigation?.bottomNav?.library || 'Library',
    href: '/library',
    icon: RiBook2Line,
    activeIcon: RiBook2Fill,
    matchPaths: ['/library'],
  },
  {
    id: 'stories',
    label: strings.dashboard?.navigation?.bottomNav?.stories || 'Stories',
    href: '/stories',
    icon: RiBookReadLine,
    activeIcon: RiBookReadFill,
    matchPaths: ['/stories'],
  },
  {
    id: 'flashcards',
    label: strings.dashboard?.navigation?.bottomNav?.cards || 'Cards',
    href: '/flashcards',
    icon: RiStackLine,
    activeIcon: RiStackFill,
    matchPaths: ['/flashcards', '/lists'],
  },
  {
    id: 'account',
    label: strings.dashboard?.navigation?.bottomNav?.account || 'Account',
    href: '/account',
    icon: RiUser3Line,
    activeIcon: RiUser3Fill,
    matchPaths: ['/account'],
  },
  {
    id: 'settings',
    label: strings.dashboard?.navigation?.bottomNav?.settings || 'Settings',
    href: '/settings',
    icon: RiSettings4Line,
    activeIcon: RiSettings4Fill,
    matchPaths: ['/settings'],
  },
]

interface BottomNavProps {
  className?: string
  /**
   * Whether to hide the navbar on scroll (default: false)
   * Setting to false keeps navbar always visible (recommended for accessibility)
   */
  hideOnScroll?: boolean
}

export default function BottomNav({ className, hideOnScroll = false }: BottomNavProps) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [showHandle, setShowHandle] = useState(false)
  const { strings, language } = useI18n()
  const isKeyboardVisible = useKeyboardVisible()
  const isIOSStandalone = useIsIOSStandalone()
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOpenCommandPalette = () => {
    // Dispatch custom event to open command palette
    window.dispatchEvent(new CustomEvent('openCommandPalette'))
  }

  const baseNavItems = createNavItems(handleOpenCommandPalette, strings)

  // Add locale prefix to all hrefs
  const NAV_ITEMS = useMemo(() =>
    baseNavItems.map(item => ({
      ...item,
      href: item.href ? `/${language}${item.href}` : undefined,
      // Also update matchPaths to include locale prefix
      matchPaths: item.matchPaths?.map(path => `/${language}${path}`)
    })),
    [baseNavItems, language]
  )

  // Content-aware visibility logic (OPTIONAL - disabled by default)
  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const scheduleAutoHide = () => {
    clearHideTimeout()
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      setShowHandle(true)
    }, 10000) // hide after 10 seconds
  }

  useEffect(() => {
    if (!hideOnScroll) {
      return
    }

    let lastY = 0
    let ticking = false
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null

    const handleScroll = () => {
      if (ticking) return

      ticking = true
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY

        // Show when scrolling up or at top
        if (currentScrollY < lastY || currentScrollY < 50) {
          setIsVisible(true)
          setShowHandle(false)
          scheduleAutoHide()
        }
        // Hide when scrolling down beyond threshold
        else if (currentScrollY > lastY && currentScrollY > 100) {
          setIsVisible(false)
          setShowHandle(true)
          clearHideTimeout()
        }

        lastY = currentScrollY
        ticking = false
      })

      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }

      // When scrolling stops for 500ms, show bottom nav again
      scrollTimeout = setTimeout(() => {
        setIsVisible(true)
        setShowHandle(false)
        scheduleAutoHide()
      }, 500)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
      clearHideTimeout()
    }
  }, [hideOnScroll])

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (!item.matchPaths) return false
    return item.matchPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  }

  // Hide on landing page, auth pages, onboarding pages, and waitlist (accounting for locale prefixes)
  const pathWithoutLocale = pathname?.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'
  const shouldHide = pathWithoutLocale === '/' || pathWithoutLocale === '/landing' || pathWithoutLocale === '/waitlist' || pathWithoutLocale.startsWith('/auth/') || pathWithoutLocale.startsWith('/onboarding')

  useEffect(() => {
    if (shouldHide || isKeyboardVisible) {
      clearHideTimeout()
      setIsVisible(false)
      setShowHandle(false)
      return
    }

    // Reset visibility and restart timer on route change or keyboard dismissal
    setIsVisible(true)
    setShowHandle(false)
    scheduleAutoHide()

    return () => {
      clearHideTimeout()
    }
  }, [pathname, shouldHide, isKeyboardVisible])

  const handleHandleTap = () => {
    setShowHandle(false)
    setIsVisible(true)
    scheduleAutoHide()
  }

  // Hide when keyboard is visible or on excluded pages
  if (shouldHide || isKeyboardVisible) {
    return null
  }

  // Select appropriate navbar height based on platform
  const navbarHeight = isIOSStandalone ? BOTTOM_NAV_HEIGHT_IOS_STANDALONE : BOTTOM_NAV_HEIGHT

  return (
    <>
      {/* Spacer to prevent content from being hidden behind fixed navbar */}
      <div
        className="md:hidden w-full shrink-0 pointer-events-none"
        style={{ height: `calc(${navbarHeight}px + env(safe-area-inset-bottom, ${SAFE_AREA_FALLBACK}px))` }}
        aria-hidden="true"
      />

      {/* Bottom Handle - visible when navbar is hidden */}
      <NavHandle
        isVisible={showHandle}
        position="bottom"
        variant="fab"
        onTap={handleHandleTap}
      />

      <AnimatePresence>
        {' '}
        {isVisible && (
          <motion.nav
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              // PWA safe area classes
              'pwa-bottom-nav',
              'safe-bottom',
              // Edge-to-edge positioning
              'fixed inset-x-0 bottom-0 z-50',
              'md:hidden', // Only show on mobile
              // Background
              'bg-transparent', // Transparent background
              className
            )}
            data-pwa-nav
            role="navigation"
            aria-label="Bottom navigation"
          >
            {/* Glass Background Layer */}
            <div
              className={cn(
                'absolute inset-0',
                'rounded-t-3xl',
                'shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60',
                'bg-soft-white/20 dark:bg-dark-900/30',
                'backdrop-blur-2xl backdrop-saturate-150',
                'border-t border-gray-200/40 dark:border-gray-700/30',
                'z-0'
              )}
            />

            {/* Inner container */}
            <div
              className={cn(
                // Positioning
                'relative',
                'z-10',

                // Shape
                'rounded-t-3xl overflow-hidden',

                // Layout: Scrollable horizontal list
                'flex items-center justify-start gap-2',
                'px-4 py-2',
                'overflow-x-auto scrollbar-hide'
              )}
              style={{
                // Ensure proper safe area support for all devices (iPhone X+)
                // iOS standalone mode: ultra-tight padding (2px) - safe area is reliable
                // Other modes: conservative padding (6px) for safety
                paddingBottom: isIOSStandalone
                  ? 'calc(2px + env(safe-area-inset-bottom, 0px))'
                  : 'calc(6px + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {NAV_ITEMS.map(item => {
                const active = isActive(item)
                const Icon = active ? item.activeIcon : item.icon

                const commonClassName = cn(
                  'relative flex flex-col items-center justify-center flex-shrink-0',
                  // Comfortable touch target: 60px width, 64px height for better ergonomics
                  'w-[60px] h-[64px]',
                  'rounded-2xl',
                  'transition-all duration-200',
                  // Accessibility: focus states
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-soft-white dark:focus-visible:ring-offset-dark-900',
                  // Theme-aware text colors
                  active
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                )

                const content = (
                  <>
                    {/* Icon and Label Container */}
                    <div className="relative z-10 flex flex-col items-center gap-1">
                      <Icon
                        className={cn(
                          'transition-all duration-200',
                          active ? 'w-6 h-6' : 'w-5 h-5'
                        )}
                        aria-hidden="true"
                      />

                      {/* Label */}
                      <span
                        className={cn(
                          'text-[10px] font-medium transition-all duration-200',
                          'leading-tight',
                          active ? 'opacity-100 font-semibold' : 'opacity-70'
                        )}
                      >
                        {item.label}
                      </span>
                    </div>

                    {/* Active indicator - positioned at bottom of button, above safe area */}
                    {active && (
                      <motion.div
                        layoutId="activeIndicator"
                        className={cn(
                          'absolute bottom-1 left-1/2 -translate-x-1/2',
                          'h-0.5 w-10 rounded-full',
                          'bg-primary-600 dark:bg-primary-400',
                          'shadow-sm shadow-primary-600/50 dark:shadow-primary-400/50'
                        )}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      />
                    )}

                    {/* Ripple effect on tap (mobile) - disable default tap highlight */}
                    <span
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    />
                  </>
                )

                // Render button for action items, Link for navigation items
                if (item.action) {
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={commonClassName}
                      aria-label={item.label}
                    >
                      {content}
                    </button>
                  )
                }

                return (
                  <Link
                    key={item.id}
                    href={item.href!}
                    className={commonClassName}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    {content}
                  </Link>
                )
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
