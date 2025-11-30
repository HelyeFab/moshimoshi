'use client'

/**
 * Push Notifications Hook
 * Initializes FCM when user grants notification permission and is logged in
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { PushNotificationService } from '@/lib/notifications/push/PushNotificationService'

interface UsePushNotificationsReturn {
  isInitialized: boolean
  isSupported: boolean
  permissionStatus: NotificationPermission
  initialize: () => Promise<boolean>
  error: string | null
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default')
  const [error, setError] = useState<string | null>(null)
  const initializingRef = useRef(false)

  // Check if push notifications are supported
  const isSupported = typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  // Update permission status
  useEffect(() => {
    if (isSupported) {
      setPermissionStatus(Notification.permission)
    }
  }, [isSupported])

  // Initialize FCM when conditions are met
  const initialize = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Push notifications not supported in this browser')
      return false
    }

    if (!user) {
      setError('User must be logged in for push notifications')
      return false
    }

    if (initializingRef.current) {
      return false
    }

    if (Notification.permission !== 'granted') {
      setError('Notification permission not granted')
      return false
    }

    // Check for VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    if (!vapidKey) {
      console.warn('[PushNotifications] VAPID key not configured - push notifications disabled')
      setError('Push notifications not configured')
      return false
    }

    try {
      initializingRef.current = true
      setError(null)

      const pushService = PushNotificationService.getInstance()
      const success = await pushService.initialize(user.uid)

      if (success) {
        setIsInitialized(true)
        console.log('[PushNotifications] Successfully initialized for user:', user.uid)
      } else {
        setError('Failed to initialize push notifications')
      }

      return success
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[PushNotifications] Initialization error:', message)
      setError(message)
      return false
    } finally {
      initializingRef.current = false
    }
  }, [user, isSupported])

  // Auto-initialize when user is logged in and permission is granted
  useEffect(() => {
    if (user && isSupported && Notification.permission === 'granted' && !isInitialized) {
      // Small delay to ensure service workers are ready
      const timer = setTimeout(() => {
        initialize()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [user, isSupported, isInitialized, initialize])

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return

    const checkPermission = () => {
      const newPermission = Notification.permission
      if (newPermission !== permissionStatus) {
        setPermissionStatus(newPermission)

        // If permission was just granted, try to initialize
        if (newPermission === 'granted' && user && !isInitialized) {
          initialize()
        }
      }
    }

    // Check periodically (no native event for permission changes)
    const interval = setInterval(checkPermission, 1000)

    return () => clearInterval(interval)
  }, [isSupported, permissionStatus, user, isInitialized, initialize])

  return {
    isInitialized,
    isSupported,
    permissionStatus,
    initialize,
    error
  }
}
