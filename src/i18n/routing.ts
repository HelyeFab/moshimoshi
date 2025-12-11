import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/**
 * Supported locales for the application.
 * These match the existing Language type from the client-side i18n system.
 */
export const locales = ['en', 'ja', 'de', 'es', 'fr', 'it'] as const;

/**
 * Default locale for the application.
 */
export const defaultLocale = 'en' as const;

/**
 * Type representing a valid locale.
 */
export type Locale = (typeof locales)[number];

/**
 * Language display names for UI.
 */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  de: 'Deutsch',
  es: 'Espanol',
  fr: 'Francais',
  it: 'Italiano',
};

/**
 * next-intl routing configuration.
 *
 * Strategy: 'prefix-always' ensures all routes have a locale prefix (e.g., /en/, /ja/)
 * This is required for proper SEO and user experience with language-specific URLs.
 */
export const routing = defineRouting({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale,

  // The default locale is prefixed in the URL for consistency
  // This means /en/dashboard instead of /dashboard for English users
  localePrefix: 'always',

  // Disable automatic locale detection from Accept-Language header.
  // We rely on:
  // 1. URL path (e.g., /ja/dashboard) - always respected
  // 2. Cookie (NEXT_LOCALE) - set when user explicitly changes language
  // 3. Default locale (en) - for new visitors without a cookie
  //
  // This prevents the browser's system locale from overriding user's explicit choice.
  localeDetection: false,
});

/**
 * Lightweight wrappers around Next.js navigation APIs
 * that consider the routing configuration.
 *
 * These should be used instead of next/link and next/navigation
 * to ensure locale-aware navigation.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
