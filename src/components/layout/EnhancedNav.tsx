'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import NavHandle from './NavHandle';
import { cn } from '@/lib/utils';

interface EnhancedNavProps {
  user?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    isAdmin?: boolean;
  } | null;
  showUserMenu?: boolean;
  backLink?: {
    href: string;
    label: string;
  } | string;
  /**
   * Whether to show the bottom navigation bar
   */
  showBottomNav?: boolean;
  /**
   * Whether to auto-hide top navbar on mobile on scroll
   */
  autoHideTopNav?: boolean;
}

/**
 * Enhanced navigation system with:
 * - Top navbar with auto-hide on mobile
 * - Bouncing handle indicator when hidden
 * - Bottom floating navigation bar
 * - Content-aware visibility
 */
export default function EnhancedNav({
  user,
  showUserMenu = true,
  backLink,
  showBottomNav = true,
  autoHideTopNav = true
}: EnhancedNavProps) {
  const [showTopNav, setShowTopNav] = useState(false); // START HIDDEN on mobile
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Desktop: always show top navbar
  // Mobile: keep hidden
  useEffect(() => {
    if (!autoHideTopNav) {
      setShowTopNav(true); // Auto-hide disabled, always show
    } else if (isMobile) {
      setShowTopNav(false); // Mobile: hidden by default
    } else {
      setShowTopNav(true); // Desktop: always visible
    }
  }, [autoHideTopNav, isMobile]);

  // Auto-hide top navbar on mobile after 6 seconds
  useEffect(() => {
    if (!isMobile || !autoHideTopNav || !showTopNav) return;

    const hideTimeout = setTimeout(() => {
      setShowTopNav(false);
    }, 6000);

    return () => clearTimeout(hideTimeout);
  }, [showTopNav, isMobile, autoHideTopNav]);

  // Pull-down gesture to show navbar (mobile only)
  useEffect(() => {
    if (!isMobile || !autoHideTopNav) return;

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // Pull-down detection
      if (window.scrollY === 0 && diff > 30) {
        setShowTopNav(true);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isMobile, autoHideTopNav]);

  const handleNavHandleTap = () => {
    setShowTopNav(prev => !prev); // Toggle navbar on tap
  };

  return (
    <>
      {/* Top Navbar */}
      {/* Desktop: always visible with native sticky behavior */}
      {!isMobile && (
        <Navbar user={user} showUserMenu={showUserMenu} backLink={backLink} />
      )}

      {/* Mobile: conditional visibility with slide animation */}
      {isMobile && (
        <AnimatePresence mode="wait">
          {showTopNav && (
            <motion.div
              key="mobile-navbar"
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 right-0 z-[54]"
            >
              <Navbar user={user} showUserMenu={showUserMenu} backLink={backLink} />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Bouncing Handle - shows when top navbar is hidden on mobile */}
      <NavHandle
        isVisible={!showTopNav && isMobile && autoHideTopNav}
        position="top"
        onTap={handleNavHandleTap}
      />

      {/* Bottom Navigation Bar - Edge-to-edge, always visible design */}
      {showBottomNav && <BottomNav hideOnScroll={false} />}
    </>
  );
}
