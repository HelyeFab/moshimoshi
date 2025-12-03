'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RiHome5Line,
  RiHome5Fill,
  RiBook2Line,
  RiBook2Fill,
  RiGamepadLine,
  RiGamepadFill,
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
  RiBookReadLine, // Story
  RiBookReadFill, // Story
} from 'react-icons/ri'
import { cn } from '@/lib/utils'
import { useBottomNav } from '@/contexts/BottomNavContext'
import { useI18n } from '@/i18n/I18nContext'
import { isFeatureEnabled } from '@/lib/features/featureFlags'

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
    id: 'dashboard',
    label: strings.dashboard?.navigation?.bottomNav?.home || 'Home',
    href: '/dashboard',
    icon: RiHome5Line,
    activeIcon: RiHome5Fill,
    matchPaths: ['/dashboard', '/'],
  },
  {
    id: 'review',
    label: strings.dashboard?.navigation?.bottomNav?.review || 'Review',
    href: '/review-dashboard',
    icon: RiBook2Line,
    activeIcon: RiBook2Fill,
    matchPaths: ['/review', '/review-dashboard', '/review/session'],
  },
  {
    id: 'kanji-browser',
    label: strings.dashboard?.navigation?.bottomNav?.kanji || 'Kanji',
    href: '/kanji-browser',
    icon: RiLinksLine, // Using RiLinksLine for now, can be updated if a more specific Kanji icon is found/preferred
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
    id: 'story',
    label: strings.dashboard?.navigation?.bottomNav?.story || 'Story',
    href: '/stories',
    icon: RiBookReadLine,
    activeIcon: RiBookReadFill,
    matchPaths: ['/stories'],
  },
  {
    id: 'games',
    label: strings.dashboard?.navigation?.bottomNav?.games || 'Games',
    href: '/games',
    icon: RiGamepadLine,
    activeIcon: RiGamepadFill,
    matchPaths: ['/games'],
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
    id: 'profile',
    label: strings.dashboard?.navigation?.bottomNav?.profile || 'Profile',
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
  {
    id: 'search',
    label: strings.dashboard?.navigation?.bottomNav?.places || 'Places',
    icon: RiSearchLine,
    activeIcon: RiSearchFill,
    action: onSearchClick,
    matchPaths: [],
  },
]

interface BottomNavProps {
  className?: string
  /**
   * Whether to hide the navbar on scroll (default: false)
   * Setting to false keeps navbar always visible (recommended for accessibility)
   */
  hideOnScroll?: boolean
  /**
   * Optional extra nav item to inject (e.g., for page-specific actions)
   */
  extraItem?: NavItem
}

export default function BottomNav({
  className,
  hideOnScroll = false,
  extraItem: propExtraItem,
}: BottomNavProps) {
  const pathname = usePathname()
  const [isVisible, setIsVisible] = useState(true)
  const [bottomGap, setBottomGap] = useState(0)
  const { extraItem: contextExtraItem } = useBottomNav()
  const { strings } = useI18n()

  // Force the document to extend to actual screen height
  useEffect(() => {
    const forceFullHeight = () => {
      const screenHeight = window.screen.height
      const innerHeight = window.innerHeight
      const gap = screenHeight - innerHeight

      console.log('[BottomNav] Forcing full screen height:', {
        screenHeight,
        innerHeight,
        gap,
        devicePixelRatio: window.devicePixelRatio,
      })

      // Force html and body to extend to actual screen height
      document.documentElement.style.minHeight = `${screenHeight}px`
      document.body.style.minHeight = `${screenHeight}px`

      setBottomGap(gap)
    }

    forceFullHeight()

    window.addEventListener('resize', forceFullHeight)
    window.addEventListener('orientationchange', forceFullHeight)

    return () => {
      window.removeEventListener('resize', forceFullHeight)
      window.removeEventListener('orientationchange', forceFullHeight)
      // Cleanup
      document.documentElement.style.minHeight = ''
      document.body.style.minHeight = ''
    }
  }, [])

  const handleOpenCommandPalette = () => {
    // Dispatch custom event to open command palette
    window.dispatchEvent(new CustomEvent('openCommandPalette'))
  }

  const baseNavItems = createNavItems(handleOpenCommandPalette, strings)

  // Filter nav items based on feature flags
  // Note: Features are DISABLED by default unless explicitly set to 'true'
  const isGamesEnabled = process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true'
  const isReviewHubEnabled = process.env.NEXT_PUBLIC_FEATURE_REVIEW_HUB === 'true'

  const filteredNavItems = baseNavItems.filter(item => {
    // Hide games if GAMES feature is disabled
    if (item.id === 'games' && !isGamesEnabled) {
      return false
    }
    // Hide review if REVIEW_HUB feature is disabled
    if (item.id === 'review' && !isReviewHubEnabled) {
      return false
    }
    return true
  })

  // Use context extra item if available, otherwise use prop
  const extraItem = contextExtraItem || propExtraItem

  // Replace search (last item) with extra item if provided, otherwise use filtered items
  const NAV_ITEMS = extraItem
    ? [...filteredNavItems.slice(0, -1), extraItem] // Replace last item (search) with extra item
    : filteredNavItems

  // Content-aware visibility logic (OPTIONAL - disabled by default)
  useEffect(() => {
    if (!hideOnScroll) {
      setIsVisible(true) // Always visible when hideOnScroll is false
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
        }
        // Hide when scrolling down beyond threshold
        else if (currentScrollY > lastY && currentScrollY > 100) {
          setIsVisible(false)
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
      }, 500)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [hideOnScroll])

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (!item.matchPaths) return false
    return item.matchPaths.some(path => pathname === path || pathname.startsWith(path + '/'))
  }

  // Hide on landing page and auth pages
  const shouldHide = pathname === '/' || pathname === '/landing' || pathname.startsWith('/auth/')

  if (shouldHide) {
    return null
  }

  return (
    <>
      {/* DEBUG: Gap filler - RED, should now reach actual screen edge */}
      <div
        className="fixed left-0 right-0 z-40 md:hidden"
        style={{
          bottom: 0,
          height: '150px',
          backgroundColor: '#ff0000', // RED for debugging
        }}
        aria-hidden="true"
      />

      <AnimatePresence>
        {isVisible && (
          <motion.nav
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              // Edge-to-edge positioning
              'fixed bottom-0 left-0 right-0 z-50 w-full',
              'md:hidden', // Only show on mobile
              className
            )}
            role="navigation"
            aria-label="Bottom navigation"
          >
            {/* Shadow Layer - Separate from glass to prevent clipping issues */}
            <div className="absolute inset-0 rounded-t-3xl shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60 pointer-events-none" />

            {/* Edge-to-edge glassmorphic container with safe area support */}
            <div
              className={cn(
                // Positioning for pseudo-element
                'relative',

                // Shape & Clipping - CRITICAL for removing "ghost rectangle"
                'rounded-t-3xl overflow-hidden',

                // Theme-aware glassmorphism background (lower opacity for glass effect)
                'bg-soft-white/20 dark:bg-dark-900/30',
                'backdrop-blur-2xl backdrop-saturate-150',

                // Top border with glassmorphism aesthetic
                'border-t border-gray-200/40 dark:border-gray-700/30',

                // Subtle top glow effect using pseudo-element (stronger for glass effect)
                'before:absolute before:inset-x-0 before:top-0 before:h-px',
                'before:bg-gradient-to-r before:from-transparent before:via-gray-100/60 dark:before:via-gray-600/40 before:to-transparent',

                // Optional: Add a subtle inner glow for more depth
                'after:absolute after:inset-0 after:rounded-t-3xl after:pointer-events-none',
                'after:bg-gradient-to-b after:from-white/5 dark:after:from-white/10 after:to-transparent after:h-1/2'
              )}
              style={{
                // Minimal bottom padding - icons sit at device edge
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Scrollable horizontal list - pt-3 only, bottom padding handled by parent safe area */}
              <div className="flex items-center justify-start gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide">
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
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
