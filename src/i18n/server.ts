import { getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { locales, defaultLocale, type Locale } from './routing';
import { getTranslation, translations } from './config';

/**
 * OpenGraph locale mapping.
 * Maps our locale codes to full OpenGraph locale format (language_TERRITORY).
 */
const ogLocaleMap: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  it: 'it_IT',
};

/**
 * Get translations for a specific locale in server components.
 *
 * This function provides access to the existing translation system
 * from server components. It returns a translation function `t`
 * and the full `strings` object.
 *
 * @param locale - Optional locale override. If not provided, uses the current request locale.
 * @returns Translation utilities for the specified locale.
 *
 * @example
 * // In a server component
 * import { getTranslations } from '@/i18n/server';
 *
 * export default async function Page() {
 *   const { t, strings } = await getTranslations();
 *   return <h1>{t('common.welcome')}</h1>;
 * }
 */
export async function getTranslations(localeOverride?: Locale) {
  // Get the locale from the request or use the override
  const currentLocale = localeOverride || ((await getLocale()) as Locale);

  // Ensure valid locale
  const locale = locales.includes(currentLocale) ? currentLocale : defaultLocale;

  // Create a translation function bound to this locale
  const t = (path: string, params?: Record<string, string | number>): string => {
    return getTranslation(locale, path, params);
  };

  // Get the strings object for direct property access
  const strings = translations[locale] || translations[defaultLocale];

  return {
    t,
    strings,
    locale,
  };
}

/**
 * Helper type for metadata generation with locale support.
 */
export interface LocalizedMetadataOptions {
  title: string;
  description: string;
  /** Optional path without locale prefix (e.g., '/about' or '/learn/grammar/teiru') */
  path?: string;
  /** Optional title template, defaults to '%s | Moshimoshi' */
  titleTemplate?: string;
  /** Additional metadata properties */
  other?: Partial<Metadata>;
}

/**
 * Generate localized metadata for a page.
 *
 * This helper creates Next.js Metadata with proper locale-specific
 * alternate links for SEO.
 *
 * @param options - Metadata options
 * @returns Next.js Metadata object
 *
 * @example
 * // In a page.tsx
 * import { generateLocalizedMetadata } from '@/i18n/server';
 *
 * export async function generateMetadata({ params }: Props): Promise<Metadata> {
 *   const { locale } = await params;
 *   const { t } = await getTranslations(locale);
 *
 *   return generateLocalizedMetadata({
 *     title: t('dashboard.title'),
 *     description: t('dashboard.description'),
 *   });
 * }
 */
export async function generateLocalizedMetadata(
  options: LocalizedMetadataOptions
): Promise<Metadata> {
  const { title, description, path, titleTemplate = '%s | Moshimoshi', other = {} } = options;
  const currentLocale = (await getLocale()) as Locale;

  // Generate alternate links for all locales
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app';
  const localePrefixRegex = new RegExp(`^/(${locales.join('|')})(?=/|$)`, 'i');
  const rawPath = path ?? '';
  const normalizedPath = rawPath
    ? rawPath.startsWith('/') ? rawPath : `/${rawPath}`
    : '';
  const pathWithoutLocale = normalizedPath.replace(localePrefixRegex, '');
  const canonicalPath = pathWithoutLocale === '/' ? '' : pathWithoutLocale.replace(/\/$/, '');

  // Create language alternates for SEO
  const languages: Record<string, string> = {};
  for (const loc of locales) {
    languages[loc] = `${baseUrl}/${loc}${canonicalPath}`;
  }
  // Add x-default for users with unsupported locales (falls back to English)
  languages['x-default'] = `${baseUrl}/${defaultLocale}${canonicalPath}`;

  return {
    title: {
      default: title,
      template: titleTemplate,
    },
    description,
    alternates: {
      canonical: `${baseUrl}/${currentLocale}${canonicalPath}`,
      languages,
    },
    openGraph: {
      title,
      description,
      locale: ogLocaleMap[currentLocale] || 'en_US',
      alternateLocale: locales
        .filter((l) => l !== currentLocale)
        .map((l) => ogLocaleMap[l]),
    },
    ...other,
  };
}

/**
 * Get the current locale in a server component.
 *
 * This is a convenience wrapper around next-intl's getLocale
 * that returns a typed Locale value.
 *
 * @returns The current request locale
 */
export async function getCurrentLocale(): Promise<Locale> {
  const locale = await getLocale();
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

/**
 * Check if a locale is valid.
 *
 * @param locale - The locale string to check
 * @returns True if the locale is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

// Re-export types and constants for convenience
export { locales, defaultLocale, type Locale };
