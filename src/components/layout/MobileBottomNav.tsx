"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Layers,
  LayoutGrid,
  Zap,
  Youtube,
  Newspaper,
  BookOpen,
  BookText,
  User,
  Settings,
  Command,
  ReceiptJapaneseYen,
  WalletCards,
  BookA,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useKeyboardVisible } from "@/hooks/useMediaQuery";
import { SAFE_AREA_FALLBACK } from "@/lib/constants/layout";
import NavHandle from "./NavHandle";

interface MobileBottomNavProps {
  /**
   * Whether to hide the navbar on scroll (default: true)
   */
  hideOnScroll?: boolean;
}

const MobileBottomNav = ({ hideOnScroll = true }: MobileBottomNavProps) => {
  const pathname = usePathname();
  const { strings, language } = useI18n();
  const isKeyboardVisible = useKeyboardVisible();
  const [isVisible, setIsVisible] = useState(true);
  const [showHandle, setShowHandle] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect Android
  useEffect(() => {
    setIsAndroid(/android/i.test(navigator.userAgent));
  }, []);

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("openCommandPalette"));
  };

  const bottomNavStrings = strings.dashboard?.navigation?.bottomNav;

  // Nav items with locale prefix
  const navItems = useMemo(() => [
    { href: `/${language}/dashboard`, label: bottomNavStrings?.home || "Home", icon: Home },
    { href: `/${language}/kanji-browser`, label: bottomNavStrings?.kanjiConnections || "Kanji", icon: ReceiptJapaneseYen },
    { href: `/${language}/kanji-moods`, label: bottomNavStrings?.moodBoards || "Boards", icon: LayoutGrid },
    { href: `/${language}/drill`, label: bottomNavStrings?.drill || "Drill", icon: Zap },
    { href: `/${language}/youtube-shadowing`, label: bottomNavStrings?.youtubeShadowing || "Shadow", icon: Youtube },
    { href: `/${language}/news`, label: bottomNavStrings?.news || "News", icon: Newspaper },
    { href: `/${language}/library`, label: bottomNavStrings?.library || "Library", icon: BookOpen },
    { href: `/${language}/stories`, label: bottomNavStrings?.stories || "Stories", icon: BookText },
    { href: `/${language}/vocabulary`, label: bottomNavStrings?.vocabulary || "Vocabulary", icon: BookA },
    { href: `/${language}/flashcards`, label: bottomNavStrings?.cards || "Cards", icon: WalletCards },
    { href: `/${language}/account`, label: bottomNavStrings?.account || "Account", icon: User },
    { href: `/${language}/settings`, label: bottomNavStrings?.settings || "Settings", icon: Settings },
  ], [language, bottomNavStrings]);

  // Clear hide timeout
  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  // Schedule auto-hide after 10 seconds
  const scheduleAutoHide = () => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setShowHandle(true);
    }, 10000);
  };

  // Hide on scroll logic
  useEffect(() => {
    if (!hideOnScroll) return;

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
          setShowHandle(false);
          scheduleAutoHide();
        }
        // Hide when scrolling down beyond threshold
        else if (currentScrollY > lastY && currentScrollY > 100) {
          setIsVisible(false);
          setShowHandle(true);
          clearHideTimeout();
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
        setShowHandle(false);
        scheduleAutoHide();
      }, 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      clearHideTimeout();
    };
  }, [hideOnScroll]);

  // Extended hide logic: landing, auth, onboarding, waitlist pages
  const pathWithoutLocale = pathname?.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const shouldHide =
    pathWithoutLocale === "/" ||
    pathWithoutLocale === "/landing" ||
    pathWithoutLocale === "/waitlist" ||
    pathWithoutLocale.startsWith("/auth/") ||
    pathWithoutLocale.includes("/auth") ||
    pathWithoutLocale.startsWith("/onboarding");

  // Reset visibility on route change or keyboard state change
  useEffect(() => {
    if (shouldHide || isKeyboardVisible) {
      clearHideTimeout();
      setIsVisible(false);
      setShowHandle(false);
      return;
    }

    setIsVisible(true);
    setShowHandle(false);
    scheduleAutoHide();

    return () => {
      clearHideTimeout();
    };
  }, [pathname, shouldHide, isKeyboardVisible]);

  // Handle NavHandle tap - shows navbar only
  const handleHandleTap = () => {
    setShowHandle(false);
    setIsVisible(true);
    scheduleAutoHide();
  };

  // Don't render on excluded pages or when keyboard is visible
  if (shouldHide || isKeyboardVisible) {
    return null;
  }

  return (
    <>
      {/* NavHandle - shows when navbar is hidden */}
      <NavHandle
        isVisible={showHandle}
        position="bottom"
        variant="fab"
        onTap={handleHandleTap}
      />

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-4 w-full flex justify-center z-50 md:hidden px-6"
            style={{
              bottom: `calc(16px + env(safe-area-inset-bottom, ${SAFE_AREA_FALLBACK}px))`,
            }}
          >
            <div className="w-full">
              <div className="relative bg-white/20 dark:bg-dark-800/20 backdrop-blur-xl rounded-full shadow-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
                {/* Top-left curved white border accent */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none z-20"
                  style={{
                    maskImage: "linear-gradient(135deg, black 0%, black 5%, transparent 12%)",
                    WebkitMaskImage: "linear-gradient(135deg, black 0%, black 5%, transparent 12%)",
                  }}
                />
                {/* Bottom-right curved white border accent */}
                <div
                  className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none z-20"
                  style={{
                    maskImage: "linear-gradient(-45deg, black 0%, black 5%, transparent 12%)",
                    WebkitMaskImage: "linear-gradient(-45deg, black 0%, black 5%, transparent 12%)",
                  }}
                />

                {/* Left gradient fade */}
                <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white/20 dark:from-dark-800/20 to-transparent z-10 pointer-events-none rounded-l-full" />
                {/* Right gradient fade */}
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/20 dark:from-dark-800/20 to-transparent z-10 pointer-events-none rounded-r-full" />

                <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide scroll-smooth snap-x snap-mandatory">
                  <div className={`flex items-center justify-start ${isAndroid ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
                    {/* Command icon - opens command palette */}
                    <button
                      onClick={openCommandPalette}
                      className="flex flex-col items-center justify-center font-medium transition-colors px-2 py-1.5 flex-shrink-0 snap-center text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400"
                      style={{ fontSize: "10px" }}
                    >
                      <Command className="w-6 h-6" />
                      <span className="opacity-0 pointer-events-none">nav</span>
                    </button>

                    {navItems.map(({ href, label, icon: Icon }) => {
                      const isActive = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`flex flex-col items-center justify-center font-medium transition-colors px-2 py-1.5 flex-shrink-0 snap-center ${
                            isActive
                              ? "text-primary-500 dark:text-primary-400"
                              : "text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400"
                          }`}
                          style={{ fontSize: "10px" }}
                        >
                          <Icon className="w-6 h-6" />
                          <span>{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileBottomNav;
