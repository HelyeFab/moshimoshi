"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import MoshimoshiLogo from "@/components/ui/MoshimoshiLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useI18n, useLocalePath } from "@/i18n/I18nContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/useMediaQuery";
// Premium gradient border - no import needed
import SyncStatusMenuItem from "@/components/sync/SyncStatusMenuItem";
import BuyMeACoffeeButton from "@/components/common/BuyMeACoffeeButton";

interface NavbarProps {
  user?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    isAdmin?: boolean;
  } | null;
  showUserMenu?: boolean;
  backLink?:
    | {
        href: string;
        label: string;
      }
    | string;
}

export default function Navbar({
  user,
  showUserMenu = true,
  backLink,
}: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { strings, language } = useI18n();
  const { getLocalePath } = useLocalePath();
  const { isPremium } = useSubscription();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [photoURL, setPhotoURL] = useState(user?.photoURL);
  const [imageKey, setImageKey] = useState(Date.now()); // For cache busting
  const isMobile = useIsMobile(); // SSR-safe: returns undefined during SSR, boolean after hydration
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLDivElement>(null);

  // Update photoURL when user prop changes
  useEffect(() => {
    setPhotoURL(user?.photoURL);
    setImageKey(Date.now()); // Force image refresh
  }, [user?.photoURL]);

  // Helper to add locale prefix to paths
  const localePath = useCallback((path: string) => `/${language}${path}`, [language]);

  // Get path without locale for comparisons
  const pathWithoutLocale = pathname?.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';

  // Determine if we should show the back to dashboard link
  // Show on all pages except dashboard, home page, and auth pages
  const shouldShowBackToDashboard =
    !backLink &&
    pathWithoutLocale !== "/" &&
    pathWithoutLocale !== "/dashboard" &&
    !pathWithoutLocale.startsWith("/auth/");

  // Listen for profile photo updates from account page
  useEffect(() => {
    const handlePhotoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ photoURL: string }>;
      setPhotoURL(customEvent.detail.photoURL);
      setImageKey(Date.now()); // Force image cache refresh
    };

    window.addEventListener('profile-photo-updated', handlePhotoUpdate);
    return () => window.removeEventListener('profile-photo-updated', handlePhotoUpdate);
  }, []);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target as Node)
      ) {
        setShowHamburgerMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
        setShowHamburgerMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });

      // Clear any guest session data
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("isGuestUser");
        sessionStorage.removeItem("guestSession");
        sessionStorage.removeItem("guest_welcomed");
      }

      router.push(getLocalePath("/auth/signin"));
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // Check if we're on the blog page for special styling
  const isBlogPage = pathname.startsWith("/blog");

  // During SSR, isMobile is undefined - render nothing to avoid hydration mismatch
  // On desktop (isMobile === false), show navbar
  // On mobile (isMobile === true), hide navbar (BottomNav handles mobile)
  if (isMobile !== false) {
    return null;
  }

  return (
    <>
      {/* Navbar - visible on desktop only (BottomNav handles mobile navigation) */}
      <AnimatePresence>
        <motion.header
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`sticky top-0 z-50 transition-all duration-300 relative ${
              isBlogPage
                ? "bg-white/20 dark:bg-dark-900/30 backdrop-blur-2xl backdrop-saturate-150 border-b border-japanese-sakura/40 dark:border-japanese-sakuraDark/30 shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-japanese-sakura/60 dark:before:via-japanese-sakuraDark/40 before:to-transparent"
                : "bg-soft-white/20 dark:bg-dark-900/30 backdrop-blur-2xl backdrop-saturate-150 border-b border-gray-200/40 dark:border-gray-700/30 shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60 before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-gray-100/60 dark:before:via-gray-600/40 before:to-transparent"
            }`}
          >
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex justify-between items-center">
          {/* Enhanced Logo for blog pages */}
          <Link href={localePath("/dashboard")} className="group flex items-center gap-2">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl group-hover:animate-bounce transition-all duration-300 ${
                isBlogPage
                  ? "bg-gradient-to-br from-japanese-sakura to-japanese-zen shadow-lg shadow-japanese-sakura/30 dark:shadow-japanese-sakuraDark/30"
                  : "bg-primary-500"
              }`}
            >
              も
            </div>
            {/* Hide MoshimoshiLogo on mobile, show on desktop */}
            <div className="hidden sm:block">
              <MoshimoshiLogo
                size="small"
                variant="compact"
                className="group-hover:scale-105 transition-transform"
              />
            </div>
            {/* Blog indicator */}
            {isBlogPage && (
              <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1 bg-gradient-to-r from-japanese-sakura/20 to-japanese-matcha/20 dark:from-japanese-sakuraDark/20 dark:to-japanese-matchaDark/20 rounded-full">
                <div className="w-2 h-2 bg-japanese-sakura rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Blog
                </span>
              </div>
            )}
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Blog-specific navigation */}
            {isBlogPage && (
              <div className="hidden lg:flex items-center gap-4">
                <Link
                  href={localePath("/dashboard")}
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-japanese-sakura dark:hover:text-japanese-sakuraDark transition-colors"
                >
                  Learn Japanese
                </Link>
                <Link
                  href={localePath("/blog")}
                  className="text-sm font-medium text-japanese-sakura dark:text-japanese-sakuraDark"
                >
                  Blog
                </Link>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
              </div>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Back Link - Show custom backLink or auto Back to Dashboard */}
            {(backLink || shouldShowBackToDashboard) && !isBlogPage && (
              <Link
                href={typeof backLink === 'object' ? localePath(backLink?.href) : (backLink ? localePath(backLink) : localePath("/dashboard"))}
                className="px-4 py-2 text-sm font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all duration-200"
              >
                {(typeof backLink === 'object' ? backLink?.label : null) ||
                  strings.navigation?.backToDashboard ||
                  "← Back to Dashboard"}
              </Link>
            )}

            {/* Enhanced Sign In Button for blog visitors */}
            {showUserMenu && !user && (
              <div className="flex items-center gap-2">
                {isBlogPage && (
                  <Link
                    href={localePath("/dashboard")}
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-japanese-sakura dark:hover:text-japanese-sakuraDark transition-colors"
                  >
                    <span>🚀</span>
                    <span>Start Learning</span>
                  </Link>
                )}
                <Link
                  href={localePath("/auth/signin")}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 ${
                    isBlogPage
                      ? "bg-gradient-to-r from-japanese-sakura to-japanese-zen hover:from-japanese-sakuraDark hover:to-japanese-zenDark shadow-lg shadow-japanese-sakura/30 dark:shadow-japanese-sakuraDark/30 hover:scale-105"
                      : "bg-primary-500 hover:bg-primary-600"
                  }`}
                >
                  {isBlogPage
                    ? "Join Moshimoshi"
                    : strings.common?.signIn || "Sign In"}
                </Link>
              </div>
            )}

            {/* User Menu - Only show for authenticated users */}
            {showUserMenu && user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
                  aria-label="User menu"
                  aria-expanded={showDropdown}
                  aria-haspopup="menu"
                  aria-controls="user-menu-dropdown"
                >
                  <div className="relative">
                    {/* Premium gradient ring wrapper */}
                    {isPremium ? (
                      <div className="relative">
                        {/* Spinning gradient border */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 animate-gradient-rotate"></div>
                        {/* Static inner content */}
                        <div className="relative m-[2px] bg-white dark:bg-dark-900 rounded-full p-[2px]">
                          {photoURL ? (
                            <Image
                              key={imageKey}
                              src={photoURL}
                              alt="Profile"
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-full object-cover"
                              unoptimized={photoURL.includes('firebasestorage') || photoURL.startsWith('/usr_profile/')}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold">
                              {user.email?.[0]?.toUpperCase() || "U"}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        {photoURL ? (
                          <Image
                            key={imageKey}
                            src={photoURL}
                            alt="Profile"
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full ring-2 ring-gray-200 dark:ring-gray-700 object-cover"
                            unoptimized={photoURL.includes('firebasestorage') || photoURL.startsWith('/usr_profile/')}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold">
                            {user.email?.[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div
                    id="user-menu-dropdown"
                    role="menu"
                    aria-label="User menu options"
                    className="absolute right-0 mt-2 w-64 bg-soft-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 py-2 z-50"
                  >
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Sync Status */}
                    <SyncStatusMenuItem />

                    {/* Menu Items */}
                    <Link
                      href={localePath("/dashboard")}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                          />
                        </svg>
                        {strings.navigation?.dashboard || "Dashboard"}
                      </div>
                    </Link>

                    <Link
                      href={localePath("/account")}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        {strings.navigation?.account || "Account"}
                      </div>
                    </Link>

                    <Link
                      href={localePath("/settings")}
                      role="menuitem"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {strings.navigation?.settings || "Settings"}
                      </div>
                    </Link>

                    {/* Admin Link (if admin) */}
                    {user?.isAdmin === true && (
                      <Link
                        href={localePath("/admin")}
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            />
                          </svg>
                          {strings.navigation?.adminDashboard ||
                            "Admin Dashboard"}
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
                        role="menuitem"
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          {strings.common?.signOut || "Sign Out"}
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
        </motion.header>
      </AnimatePresence>
    </>
  );
}
