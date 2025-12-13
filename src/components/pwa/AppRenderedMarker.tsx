'use client'

import { useEffect } from 'react'
import { markAppRendered } from '@/lib/pwa/splashRecovery'

/**
 * Invisible marker component that signals the app has rendered successfully.
 * Used by the splash screen recovery system to detect stuck states.
 *
 * This component:
 * 1. Renders a hidden sentinel element with data-app-rendered="true"
 * 2. Calls markAppRendered() on mount to clear any recovery state
 */
export function AppRenderedMarker() {
  useEffect(() => {
    // Clear any recovery state since app has rendered
    markAppRendered()
  }, [])

  // Hidden sentinel element for the recovery system to detect
  return <div data-app-rendered="true" aria-hidden="true" style={{ display: 'none' }} />
}
