'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { registerServiceWorker } from '@/lib/pwa/registerServiceWorker'
import { initSplashRecovery } from '@/lib/pwa/splashRecovery'
import { UpdateBanner, UpdateIndicator } from './UpdateBanner'

// App version - bump this for critical updates
// This is checked against the deployed version to detect critical updates
const APP_VERSION = '1.0.3' // Increment for each deployment

// localStorage key for tracking dismissed version
const DISMISSED_VERSION_KEY = 'pwa-dismissed-version'

interface VersionInfo {
  version: string
  critical?: boolean
  message?: string
}

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showIndicator, setShowIndicator] = useState(false)
  const [serverVersion, setServerVersion] = useState<string | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  // Track if user has dismissed the current update to prevent interval from re-showing
  const userDismissedRef = useRef(false)

  // Check if this is a critical update by comparing versions
  const checkForCriticalUpdate = useCallback(async () => {
    try {
      // Fetch version info from a static JSON file
      // This file should be updated on each deployment
      const response = await fetch('/version.json', {
        cache: 'no-store', // Always fetch fresh
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (response.ok) {
        const versionInfo: VersionInfo = await response.json()

        // Check if server version is newer
        if (versionInfo.version !== APP_VERSION) {
          console.log(`[SW] Version mismatch: local=${APP_VERSION}, server=${versionInfo.version}`)

          // Check if user already dismissed this specific version
          const dismissedVersion = localStorage.getItem(DISMISSED_VERSION_KEY)
          const alreadyDismissed = dismissedVersion === versionInfo.version

          setServerVersion(versionInfo.version)
          setUpdateAvailable(true)
          setIsCriticalUpdate(versionInfo.critical === true)

          // Only show banner if:
          // 1. Not already dismissed this version, AND
          // 2. User hasn't dismissed during this session
          if (!alreadyDismissed && !userDismissedRef.current) {
            setShowBanner(true)
          }
          return true
        }
      }
    } catch (error) {
      // version.json doesn't exist or network error - that's okay
      console.log('[SW] Could not check version.json:', error)
    }
    return false
  }, [])

  useEffect(() => {
    // Initialize splash screen recovery detection (for PWA stuck states)
    // This must run early to detect if app fails to render
    initSplashRecovery()

    // Register service worker on mount
    registerServiceWorker()

    // Listen for update events from service worker
    const handleUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ registration: ServiceWorkerRegistration }>

      // Store the registration for later use
      if (customEvent.detail?.registration) {
        registrationRef.current = customEvent.detail.registration
      }

      setUpdateAvailable(true)

      // Check if this is a critical update
      const isCritical = await checkForCriticalUpdate()

      if (!isCritical) {
        // For non-critical updates, just show the banner
        setShowBanner(true)
      }

      console.log('[SW] Update available, critical:', isCritical)
    }

    window.addEventListener('sw-update-available', handleUpdate)

    // Also check for version mismatch on mount (handles page refresh scenario)
    checkForCriticalUpdate()

    // Periodically check for updates (every 5 minutes)
    const intervalId = setInterval(
      () => {
        checkForCriticalUpdate()
      },
      5 * 60 * 1000
    )

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate)
      clearInterval(intervalId)
    }
  }, [checkForCriticalUpdate])

  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false)
    // Show the floating indicator as a reminder
    setShowIndicator(true)
    // Mark as dismissed for this session to prevent interval from re-showing
    userDismissedRef.current = true
    // Persist dismissed version to localStorage (non-critical only)
    // Critical updates will keep showing the indicator
    if (serverVersion && !isCriticalUpdate) {
      localStorage.setItem(DISMISSED_VERSION_KEY, serverVersion)
    }
  }, [serverVersion, isCriticalUpdate])

  const handleIndicatorClick = useCallback(() => {
    setShowIndicator(false)
    setShowBanner(true)
    // User wants to see banner again, allow it
    userDismissedRef.current = false
  }, [])

  return (
    <>
      {children}

      {/* Update UI */}
      {updateAvailable && showBanner && (
        <UpdateBanner isCritical={isCriticalUpdate} onDismiss={handleBannerDismiss} />
      )}

      {/* Floating indicator when banner is dismissed */}
      {updateAvailable && showIndicator && !showBanner && (
        <UpdateIndicator onClick={handleIndicatorClick} />
      )}
    </>
  )
}
