const STORAGE_PREFIX = 'word_lookup_seen_'

const getUtcDateKey = () => new Date().toISOString().slice(0, 10)

const getStorageKey = () => `${STORAGE_PREFIX}${getUtcDateKey()}`

const loadSeenSet = (): Set<string> => {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter(entry => typeof entry === 'string'))
  } catch {
    return new Set()
  }
}

const persistSeenSet = (seen: Set<string>) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(Array.from(seen)))
  } catch {
    // Ignore storage errors to avoid breaking lookups
  }
}

export const hasSeenWordLookup = (word: string): boolean => {
  const normalized = word.trim()
  if (!normalized) return false
  return loadSeenSet().has(normalized)
}

export const markWordLookupSeen = (word: string): void => {
  const normalized = word.trim()
  if (!normalized) return
  const seen = loadSeenSet()
  if (seen.has(normalized)) return
  seen.add(normalized)
  persistSeenSet(seen)
}
