'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Language, defaultLanguage, translations, getTranslation, TranslationKeys, languages } from './config'

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
  const [language, setLanguageState] = useState<Language>(initialLanguage || defaultLanguage)

  // Hydrate language from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First try user-specific language
      const userId = getCurrentUserId()
      if (userId) {
        const userKey = `${USER_LANGUAGE_STORAGE_KEY}-${userId}`
        const userLang = localStorage.getItem(userKey)
        if (userLang && languages.includes(userLang as Language)) {
          setLanguageState(userLang as Language)
          return
        }
      }

      // Fall back to global language
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored && languages.includes(stored as Language)) {
        setLanguageState(stored as Language)
        return
      }

      // Check browser language
      const browserLang = navigator.language.toLowerCase()
      if (browserLang.startsWith('ja')) {
        setLanguageState('ja')
      }
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== 'undefined') {
      // Save both globally and user-specific if user is logged in
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
      const userId = getCurrentUserId()
      if (userId) {
        const userKey = `${USER_LANGUAGE_STORAGE_KEY}-${userId}`
        localStorage.setItem(userKey, lang)
      }
      // Update HTML lang attribute
      document.documentElement.lang = lang
    }
  }, [])

  const t = useCallback((path: string, paramsOrFallback?: Record<string, string | number> | string) => {
    // If second param is a string (fallback), ignore it - getTranslation handles fallbacks
    const params = typeof paramsOrFallback === 'object' ? paramsOrFallback : undefined
    return getTranslation(language, path, params)
  }, [language])

  useEffect(() => {
    // Set initial HTML lang attribute
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language
    }
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