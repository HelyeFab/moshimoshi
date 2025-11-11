'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  RiSearchFill
} from 'react-icons/ri';
import { cn } from '@/lib/utils';
import { useBottomNav } from '@/contexts/BottomNavContext';

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ElementType;
  activeIcon: React.ElementType;
  matchPaths?: string[];
  action?: () => void;
}

const createNavItems = (onSearchClick: () => void): NavItem[] => [
  {
    id: 'dashboard',
    label: 'Home',
    href: '/dashboard',
    icon: RiHome5Line,
    activeIcon: RiHome5Fill,
    matchPaths: ['/dashboard', '/']
  },
  {
    id: 'review',
    label: 'Review',
    href: '/review-dashboard',
    icon: RiBook2Line,
    activeIcon: RiBook2Fill,
    matchPaths: ['/review', '/review-dashboard', '/review/session']
  },
  {
    id: 'games',
    label: 'Games',
    href: '/games',
    icon: RiGamepadLine,
    activeIcon: RiGamepadFill,
    matchPaths: ['/games']
  },
  {
    id: 'flashcards',
    label: 'Cards',
    href: '/flashcards',
    icon: RiStackLine,
    activeIcon: RiStackFill,
    matchPaths: ['/flashcards', '/lists']
  },
  {
    id: 'search',
    label: 'Search',
    icon: RiSearchLine,
    activeIcon: RiSearchFill,
    action: onSearchClick,
    matchPaths: []
  }
];

interface BottomNavProps {
  className?: string;
  /**
   * Whether to hide the navbar on scroll (default: false)
   * Setting to false keeps navbar always visible (recommended for accessibility)
   */
  hideOnScroll?: boolean;
  /**
   * Optional extra nav item to inject (e.g., for page-specific actions)
   */
  extraItem?: NavItem;
}

export default function BottomNav({ className, hideOnScroll = false, extraItem: propExtraItem }: BottomNavProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const { extraItem: contextExtraItem } = useBottomNav();

  const handleOpenCommandPalette = () => {
    // Dispatch custom event to open command palette
    window.dispatchEvent(new CustomEvent('openCommandPalette'));
  };

  const baseNavItems = createNavItems(handleOpenCommandPalette);

  // Use context extra item if available, otherwise use prop
  const extraItem = contextExtraItem || propExtraItem;

  // Inject extra item if provided (append at the end as the last item)
  const NAV_ITEMS = extraItem
    ? [...baseNavItems, extraItem]
    : baseNavItems;

  // Content-aware visibility logic (OPTIONAL - disabled by default)
  useEffect(() => {
    if (!hideOnScroll) {
      setIsVisible(true); // Always visible when hideOnScroll is false
      return;
    }

    let lastY = 0;
    let ticking = false;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (ticking) return;

      ticking = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;

        // Show when scrolling up or at top
        if (currentScrollY < lastY || currentScrollY < 50) {
          setIsVisible(true);
        }
        // Hide when scrolling down beyond threshold
        else if (currentScrollY > lastY && currentScrollY > 100) {
          setIsVisible(false);
        }

        lastY = currentScrollY;
        ticking = false;
      });

      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // When scrolling stops for 500ms, show bottom nav again
      scrollTimeout = setTimeout(() => {
        setIsVisible(true);
      }, 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [hideOnScroll]);

  // Check if a nav item is active
  const isActive = (item: NavItem) => {
    if (!item.matchPaths) return false;
    return item.matchPaths.some(path =>
      pathname === path || pathname.startsWith(path + '/')
    );
  };

  // Hide on admin pages (admin has its own sidebar navigation)
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            // Edge-to-edge positioning (Solution A)
            'fixed bottom-0 left-0 right-0 z-50',
            'md:hidden', // Only show on mobile
            className
          )}
          role="navigation"
          aria-label="Bottom navigation"
        >
          {/* Edge-to-edge glassmorphic container with safe area support */}
          <div
            className={cn(
              // Positioning for pseudo-element
              'relative',

              // Layout: evenly distributed items with safe padding
              'flex items-center justify-around',
              'px-4 py-3',

              // Theme-aware glassmorphism background (lower opacity for glass effect)
              'bg-soft-white/20 dark:bg-dark-900/30',
              'backdrop-blur-2xl backdrop-saturate-150',

              // Top border with glassmorphism aesthetic
              'border-t border-gray-200/40 dark:border-gray-700/30',

              // Enhanced shadows for glassmorphism depth
              'shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60',

              // Subtle top glow effect using pseudo-element (stronger for glass effect)
              'before:absolute before:inset-x-0 before:top-0 before:h-px',
              'before:bg-gradient-to-r before:from-transparent before:via-gray-100/60 dark:before:via-gray-600/40 before:to-transparent',

              // Optional: Add a subtle inner glow for more depth
              'after:absolute after:inset-0 after:rounded-t-3xl after:pointer-events-none',
              'after:bg-gradient-to-b after:from-white/5 dark:after:from-white/10 after:to-transparent after:h-1/2'
            )}
            style={{
              // Ensure proper safe area support for all devices (iPhone X+)
              // Uses max() to ensure minimum padding even if safe-area-inset-bottom is 0
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))'
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const Icon = active ? item.activeIcon : item.icon;

              const commonClassName = cn(
                'relative flex flex-col items-center justify-center',
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
              );

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
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  />
                </>
              );

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
                );
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
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  </>
  );
}
