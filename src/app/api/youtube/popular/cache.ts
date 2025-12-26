// Cache for popular videos
let cachedVideos: any = null
let cacheExpiry: Date | null = null

export function getCache() {
  if (cachedVideos && cacheExpiry && cacheExpiry > new Date()) {
    return { videos: cachedVideos, isValid: true }
  }
  return { videos: null, isValid: false }
}

export function setCache(videos: any) {
  cachedVideos = videos
  cacheExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
}

export function clearCache() {
  cachedVideos = null
  cacheExpiry = null
  console.log('[Popular API] Cache cleared')
}
