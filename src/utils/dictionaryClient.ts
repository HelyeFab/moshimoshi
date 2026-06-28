/**
 * Client helper for the server-side JMDict search API.
 *
 * Replaces the previous approach of fetching the entire ~15 MB dictionary
 * JSON into the browser and scanning it client-side. The browser now sends a
 * query and receives only the matched results.
 */

import type { JapaneseWord } from '@/types/vocabulary'

export async function searchDictionary(term: string, limit = 30): Promise<JapaneseWord[]> {
  const res = await fetch(
    `/api/dictionary/search?q=${encodeURIComponent(term)}&limit=${limit}`
  )
  if (!res.ok) {
    throw new Error(`Dictionary search failed: ${res.status}`)
  }
  const data = await res.json()
  return (data.results ?? []) as JapaneseWord[]
}
