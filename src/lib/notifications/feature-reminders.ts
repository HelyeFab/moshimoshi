export type FeatureReminderKey =
  | 'kana'
  | 'kanji_mastery'
  | 'flashcards_srs'
  | 'news'
  | 'stories'
  | 'library'
  | 'vocabulary'

function normalizePath(pathname: string): string {
  const pathWithoutQuery = pathname.split('?')[0] || ''
  const segments = pathWithoutQuery.split('/').filter(Boolean)

  // Remove locale segment (e.g. /en, /ja, /fr) when present.
  if (segments[0] && /^[a-z]{2}(-[A-Z]{2})?$/.test(segments[0])) {
    return `/${segments.slice(1).join('/')}`
  }

  return pathWithoutQuery.startsWith('/') ? pathWithoutQuery : `/${pathWithoutQuery}`
}

export function deriveFeatureReminderKey(pathname: string): FeatureReminderKey | null {
  const normalized = normalizePath(pathname)

  if (normalized.startsWith('/learn/hiragana') || normalized.startsWith('/learn/katakana')) {
    return 'kana'
  }

  if (normalized.startsWith('/tools/kanji-mastery')) {
    return 'kanji_mastery'
  }

  if (
    normalized.startsWith('/flashcards') ||
    normalized.startsWith('/review') ||
    normalized.startsWith('/anki-study')
  ) {
    return 'flashcards_srs'
  }

  if (normalized === '/news' || normalized.startsWith('/news/')) {
    return 'news'
  }

  if (normalized === '/stories' || normalized.startsWith('/stories/')) {
    return 'stories'
  }

  if (normalized === '/library' || normalized.startsWith('/library/')) {
    return 'library'
  }

  if (
    normalized.startsWith('/learn/word-learning/session') ||
    normalized === '/vocabulary' ||
    normalized.startsWith('/vocabulary/')
  ) {
    return 'vocabulary'
  }

  return null
}
