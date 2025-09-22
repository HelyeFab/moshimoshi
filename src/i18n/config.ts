import { strings as enStrings } from './locales/en/strings'
import { strings as jaStrings } from './locales/ja/strings'
import { strings as frStrings } from './locales/fr/strings'
import { strings as itStrings } from './locales/it/strings'
import { strings as deStrings } from './locales/de/strings'
import { strings as esStrings } from './locales/es/strings'

export type Language = 'en' | 'ja' | 'fr' | 'it' | 'de' | 'es'

export const languages: Language[] = ['en', 'ja', 'fr', 'it', 'de', 'es']

export const defaultLanguage: Language = 'en'

export const languageNames: Record<Language, string> = {
  en: 'English',
  ja: '日本語',
  fr: 'Français',
  it: 'Italiano',
  de: 'Deutsch',
  es: 'Español',
}

export const translations = {
  en: enStrings,
  ja: jaStrings,
  fr: frStrings,
  it: itStrings,
  de: deStrings,
  es: esStrings,
} as const

export type TranslationKeys = typeof enStrings

// Helper function to get nested translation value
export function getTranslation(
  language: Language,
  path: string,
  params?: Record<string, string | number>
): string {
  const keys = path.split('.')
  let value: any = translations[language]

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      // Fallback to English if translation not found
      value = enStrings
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k]
        } else {
          return path // Return the path if translation not found
        }
      }
      break
    }
  }

  if (typeof value !== 'string') {
    return path
  }

  // Replace parameters if provided
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      value = value.replace(new RegExp(`{{${key}}}`, 'g'), String(val))
    })
  }

  return value
}