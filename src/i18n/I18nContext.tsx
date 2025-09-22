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

interface I18nProviderProps {
  children: React.ReactNode
  initialLanguage?: Language
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
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
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
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