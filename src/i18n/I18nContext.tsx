'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Language, defaultLanguage, translations, getTranslation, TranslationKeys, languages } from './config'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (path: string, params?: Record<string, string | number>) => string
  strings: typeof translations[Language]
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
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      // First try user-specific language
      const userId = getCurrentUserId()
      if (userId) {
        const userKey = `${USER_LANGUAGE_STORAGE_KEY}-${userId}`
        const userLang = localStorage.getItem(userKey)
        if (userLang && languages.includes(userLang as Language)) {
          return userLang as Language
        }
      }

      // Fall back to global language
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (stored && languages.includes(stored as Language)) {
        return stored as Language
      }

      // Check browser language
      const browserLang = navigator.language.toLowerCase()
      if (browserLang.startsWith('ja')) {
        return 'ja'
      }
    }

    return initialLanguage || defaultLanguage
  })

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

  const t = useCallback((path: string, params?: Record<string, string | number>) => {
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
    strings: translations[language],
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