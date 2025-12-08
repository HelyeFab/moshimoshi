'use client'

import { useEffect, useState } from 'react'
import { TTSLoadingOverlay } from './TTSLoadingOverlay'
import { ttsLoadingState } from '@/lib/tts/loadingState'

/**
 * TTSLoadingProvider
 *
 * App-level provider that subscribes to the global TTS loading state
 * and renders the Doshi loading overlay when audio is being fetched
 * from the API (cache miss).
 *
 * Usage: Wrap your app with this provider in layout.tsx
 *
 * Features:
 * - Single overlay instance for the entire app
 * - Automatically shows for ANY useTTS hook that fetches from API
 * - No changes needed to existing TTS-consuming components
 * - Built-in 300ms delay to prevent flicker on fast loads
 */
export function TTSLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    // Subscribe to global TTS loading state
    const unsubscribe = ttsLoadingState.subscribe(setIsFetching)
    return unsubscribe
  }, [])

  return (
    <>
      {children}
      <TTSLoadingOverlay isLoading={isFetching} />
    </>
  )
}
