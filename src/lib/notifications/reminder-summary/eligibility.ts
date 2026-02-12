export interface FeatureDefinition {
  key: string
  name: string
  defaultUrl: string
  matchesPath: (path: string) => boolean
}

export interface PageVisitRecord {
  userId: string
  path: string
  startedAt: Date
}

export interface FeatureUsageSnapshot {
  featureKey: string
  featureName: string
  featureUrl: string
  lastUsedAt: Date
}

const MAX_FEATURES_PER_USER = 5

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'kana',
    name: 'Kana Practice',
    defaultUrl: '/learn/hiragana',
    matchesPath: (path) => path.startsWith('/learn/hiragana') || path.startsWith('/learn/katakana'),
  },
  {
    key: 'kanji_mastery',
    name: 'Kanji Mastery',
    defaultUrl: '/tools/kanji-mastery',
    matchesPath: (path) => path.startsWith('/tools/kanji-mastery'),
  },
  {
    key: 'flashcards_srs',
    name: 'Flashcards & SRS',
    defaultUrl: '/review',
    matchesPath: (path) =>
      path.startsWith('/flashcards') || path.startsWith('/review') || path.startsWith('/anki-study'),
  },
  {
    key: 'news',
    name: 'News Reading',
    defaultUrl: '/news',
    matchesPath: (path) => path.startsWith('/news'),
  },
  {
    key: 'stories',
    name: 'Stories',
    defaultUrl: '/stories',
    matchesPath: (path) => path.startsWith('/stories'),
  },
  {
    key: 'library',
    name: 'Library',
    defaultUrl: '/library',
    matchesPath: (path) => path.startsWith('/library'),
  },
  {
    key: 'vocabulary',
    name: 'Vocabulary',
    defaultUrl: '/vocabulary',
    matchesPath: (path) => path.startsWith('/vocabulary') || path.startsWith('/learn/word-learning/session'),
  },
]

function stripLocaleFromPath(path: string): string {
  const withoutQuery = (path || '').split('?')[0] || ''
  if (!withoutQuery) return ''

  const segments = withoutQuery.split('/').filter(Boolean)
  if (segments.length === 0) return '/'

  if (segments[0].length === 2) {
    const remainder = segments.slice(1).join('/')
    return remainder ? `/${remainder}` : '/'
  }

  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
}

export function getFeatureForPath(path: string): FeatureDefinition | null {
  const normalizedPath = stripLocaleFromPath(path)
  for (const feature of FEATURE_DEFINITIONS) {
    if (feature.matchesPath(normalizedPath)) {
      return feature
    }
  }
  return null
}

export function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function previousDateKey(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function isGlobalReminderEnabled(preferences: Record<string, any> | undefined): boolean {
  if (!preferences) return true
  if (preferences.channels?.email === false) return false
  if (preferences.timing?.daily === false) return false
  if (preferences.email?.dailyReminder === false) return false
  if (preferences.feature_reminders?.enabled === false) return false
  return true
}

function isFeatureReminderEnabled(
  preferences: Record<string, any> | undefined,
  featureKey: string
): boolean {
  if (!isGlobalReminderEnabled(preferences)) return false

  const featureFlags = preferences?.feature_reminders?.features
  if (featureFlags && featureFlags[featureKey] === false) {
    return false
  }
  return true
}

export function computeEligibleFeaturesForUser(params: {
  now: Date
  timezone: string
  visits: PageVisitRecord[]
  preferences?: Record<string, any>
}): { localDateKey: string; features: FeatureUsageSnapshot[] } {
  const { now, timezone, visits, preferences } = params
  const todayKey = getLocalDateKey(now, timezone)
  const yesterdayKey = previousDateKey(todayKey)

  const byFeature = new Map<
    string,
    {
      definition: FeatureDefinition
      usedToday: boolean
      lastUsedYesterday: Date | null
      lastUsedYesterdayPath: string | null
    }
  >()

  for (const visit of visits) {
    const feature = getFeatureForPath(visit.path)
    if (!feature) continue

    const localVisitDay = getLocalDateKey(visit.startedAt, timezone)
    let current = byFeature.get(feature.key)
    if (!current) {
      current = {
        definition: feature,
        usedToday: false,
        lastUsedYesterday: null,
        lastUsedYesterdayPath: null,
      }
      byFeature.set(feature.key, current)
    }

    if (localVisitDay === todayKey) {
      current.usedToday = true
    } else if (
      localVisitDay === yesterdayKey &&
      (!current.lastUsedYesterday || visit.startedAt > current.lastUsedYesterday)
    ) {
      current.lastUsedYesterday = visit.startedAt
      current.lastUsedYesterdayPath = visit.path
    }
  }

  const eligible: FeatureUsageSnapshot[] = []
  for (const [featureKey, usage] of byFeature.entries()) {
    if (!usage.lastUsedYesterday || usage.usedToday) {
      continue
    }
    if (!isFeatureReminderEnabled(preferences, featureKey)) {
      continue
    }

    eligible.push({
      featureKey: usage.definition.key,
      featureName: usage.definition.name,
      featureUrl: usage.lastUsedYesterdayPath || usage.definition.defaultUrl,
      lastUsedAt: usage.lastUsedYesterday,
    })
  }

  eligible.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())

  return {
    localDateKey: todayKey,
    features: eligible.slice(0, MAX_FEATURES_PER_USER),
  }
}
