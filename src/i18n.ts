import { getRequestConfig } from 'next-intl/server';
import { routing } from '@/i18n/routing';

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
 * Utility to check if a string is a valid locale.
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * next-intl request configuration.
 * This is used by the middleware and server components to load translations.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    // For now, return empty messages since we're using the existing translation system
    // This will be populated when we migrate to next-intl message format
    messages: {},
  };
});
