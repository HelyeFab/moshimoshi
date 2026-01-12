export interface OfflineListCache<T> {
  updatedAt: number
  items: T[]
}

export function readOfflineListCache<T>(key: string): OfflineListCache<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as OfflineListCache<T>
  } catch (error) {
    console.error('[offline-list-cache] Failed to read cache:', key, error)
    return null
  }
}

export function writeOfflineListCache<T>(key: string, items: T[], limit: number): void {
  if (typeof window === 'undefined') return
  try {
    const payload: OfflineListCache<T> = {
      updatedAt: Date.now(),
      items: items.slice(0, limit),
    }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch (error) {
    console.error('[offline-list-cache] Failed to write cache:', key, error)
  }
}
