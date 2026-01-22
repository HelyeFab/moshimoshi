import { locales } from '@/i18n/routing'

export const learningVillageTrackedRoutes = [
  '/learn/hiragana',
  '/learn/katakana',
  '/drill',
  '/kanji-browser',
  '/tools/kanji-mastery',
  '/kanji-connection',
  '/learn/conjugation',
  '/vocabulary',
  '/lists',
  '/kanji-moods',
  '/textbook-vocabulary',
  '/flashcards',
  '/stories',
  '/news',
  '/library',
  '/comics',
  '/youtube-shadowing',
  '/popular-videos',
  '/youtube-series',
  '/my-videos',
  '/learn/grammar',
  '/resources',
  '/blog',
  '/village/tea-house',
] as const

export type LearningVillageRoute = (typeof learningVillageTrackedRoutes)[number]

const localePrefixRegex = new RegExp(`^/(${locales.join('|')})(?=/|$)`, 'i')

export function normalizeLearningVillagePath(pathname: string): string {
  if (!pathname) return '/'
  const cleaned = pathname.split('?')[0].split('#')[0]
  const withoutLocale = cleaned.replace(localePrefixRegex, '')
  return withoutLocale.startsWith('/') ? withoutLocale : `/${withoutLocale}`
}

export function isLearningVillageTrackedRoute(
  pathname: string
): pathname is LearningVillageRoute {
  return learningVillageTrackedRoutes.includes(pathname as LearningVillageRoute)
}

export function getLearningVillagePageKey(pathname: string): string | null {
  const normalized = normalizeLearningVillagePath(pathname)
  if (!isLearningVillageTrackedRoute(normalized)) return null
  const key = normalized.replace(/^\//, '').replace(/\//g, '_')
  return `lv_${key}`
}

export function getLearningVillageStorageKey(pathname: string): string {
  const normalized = normalizeLearningVillagePath(pathname)
  return `visited_lv_${normalized}`
}
