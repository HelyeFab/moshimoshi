'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Language, defaultLanguage, translations, getTranslation, TranslationKeys, languages } from './config'

// Valid locales - matches next-intl routing config
const validLocales = ['en', 'ja', 'de', 'es', 'fr', 'it'] as const
type ValidLocale = (typeof validLocales)[number]

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  /**
   * Translate a key path. Second parameter can be:
   * - Record for interpolation: t('greeting', { name: 'John' })
   * - String as fallback (ignored, uses path as fallback): t('key', 'Fallback')
   */
  t: (path: string, paramsOrFallback?: Record<string, string | number> | string) => string
  strings: TranslationKeys
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = 'moshimoshi-language'
const USER_LANGUAGE_STORAGE_KEY = 'moshimoshi-user-language'

// Helper to get current user ID from auth state
const getCurrentUserId = (): string | null => {
  if (typeof window === 'undefined') return null
  // Try to get user ID from session or auth state
  const authData = localStorage.getItem('auth-user')
  if (authData) {
    try {
      const user = JSON.parse(authData)
      return user?.uid || null
    } catch {
      return null
    }
  }
  return null
}

interface I18nProviderProps {
  children: React.ReactNode
  initialLanguage?: Language
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  // Get locale from URL params (provided by [locale] segment)
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()

  // Extract locale from URL - it's in the params from [locale] segment
  const urlLocale = params?.locale as string | undefined

  // Use URL locale as the source of truth, fallback to initialLanguage or default
  const effectiveLanguage = (
    urlLocale && validLocales.includes(urlLocale as ValidLocale)
      ? urlLocale
      : initialLanguage || defaultLanguage
  ) as Language

  const [language, setLanguageState] = useState<Language>(effectiveLanguage)

  // Sync language state when URL locale changes
  useEffect(() => {
    if (urlLocale && validLocales.includes(urlLocale as ValidLocale)) {
      setLanguageState(urlLocale as Language)
    }
  }, [urlLocale])

  // Save user preference to localStorage when language changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      const userId = getCurrentUserId()
      if (userId) {
        const userKey = `${USER_LANGUAGE_STORAGE_KEY}-${userId}`
        localStorage.setItem(userKey, language)
      }
      // Update HTML lang attribute
      document.documentElement.lang = language
    }
  }, [language])

  /**
   * Change language by navigating to the new locale URL.
   * This keeps the URL in sync with the language and is SEO-friendly.
   */
  const setLanguage = useCallback((lang: Language) => {
    console.log('[I18n] setLanguage called with:', lang)
    console.log('[I18n] Current language:', language)
    console.log('[I18n] Current pathname:', pathname)
    console.log('[I18n] Current urlLocale:', urlLocale)

    if (!languages.includes(lang)) {
      console.log('[I18n] Invalid language, ignoring')
      return
    }

    // Save preference to localStorage and cookie
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
      const userId = getCurrentUserId()
      if (userId) {
        const userKey = `${USER_LANGUAGE_STORAGE_KEY}-${userId}`
        localStorage.setItem(userKey, lang)
      }
      // Set the NEXT_LOCALE cookie so middleware respects user's choice
      // This prevents Accept-Language header from overriding user preference
      document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`
      console.log('[I18n] Cookie set:', document.cookie)
    }

    // Navigate to the same path with new locale
    if (pathname) {
      // Remove current locale prefix and get the path
      const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/'
      const newPath = `/${lang}${pathWithoutLocale}`
      console.log('[I18n] Navigating to:', newPath)
      // Navigate to new locale URL
      router.push(newPath)
    }
  }, [pathname, router, language, urlLocale])

  const t = useCallback((path: string, paramsOrFallback?: Record<string, string | number> | string) => {
    // If second param is a string (fallback), ignore it - getTranslation handles fallbacks
    const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined
    return getTranslation(language, path, params)
  }, [language])

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    // Cast to TranslationKeys - other locales may have missing keys but fallback logic handles it
    strings: translations[language] as TranslationKeys,
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

// Hook for using typed translation keys
export function useTranslation() {
  const { t, language, strings } = useI18n()
  return { t, language, strings }
}

/**
 * Get a locale-prefixed URL for navigation.
 * Use this for all internal navigation to ensure locale is preserved.
 *
 * @param path - The path without locale prefix (e.g., '/dashboard')
 * @param locale - Optional locale override, defaults to current language
 * @returns Locale-prefixed path (e.g., '/en/dashboard')
 */
export function useLocalePath() {
  const { language } = useI18n()

  const getLocalePath = useCallback((path: string, localeOverride?: Language): string => {
    const locale = localeOverride || language
    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    // Don't double-prefix if path already has a locale
    if (/^\/[a-z]{2}(?=\/|$)/.test(normalizedPath)) {
      return normalizedPath
    }
    return `/${locale}${normalizedPath}`
  }, [language])

  return { getLocalePath, language }
}

/**
 * Get locale from current path (client-side utility).
 * Useful when you need the locale outside of React context.
 */
export function getLocaleFromPath(): Language {
  if (typeof window === 'undefined') return defaultLanguage
  const path = window.location.pathname
  const match = path.match(/^\/([a-z]{2})(?=\/|$)/)
  if (match && validLocales.includes(match[1] as ValidLocale)) {
    return match[1] as Language
  }
  return defaultLanguage
}

/**
 * Construct a locale-prefixed URL (client-side utility).
 * Use this when you can't use the useLocalePath hook (e.g., in callbacks).
 */
export function buildLocalePath(path: string, locale?: Language): string {
  const effectiveLocale = locale || getLocaleFromPath()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  // Don't double-prefix if path already has a locale
  if (/^\/[a-z]{2}(?=\/|$)/.test(normalizedPath)) {
    return normalizedPath
  }
  return `/${effectiveLocale}${normalizedPath}`
}