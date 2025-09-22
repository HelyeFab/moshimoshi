/**
 * useNotificationOrchestrator Hook
 * React hook for initializing and managing the notification orchestrator
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { NotificationOrchestrator } from '@/lib/notifications/orchestrator/NotificationOrchestrator'
import { NotificationPreferences } from '@/lib/notifications/types/notifications.types'

/**
 * Hook state
 */
export interface NotificationOrchestratorState {
  initialized: boolean
  permission: NotificationPermission
  preferences: NotificationPreferences | null
  scheduledCount: number
  queuedCount: number
  loading: boolean
  error: Error | null
}

/**
 * Hook return value
 */
export interface UseNotificationOrchestratorReturn extends NotificationOrchestratorState {
  requestPermission: () => Promise<NotificationPermission>
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>
  sendTestNotification: () => Promise<void>
  getStats: () => Promise<any>
  refresh: () => Promise<void>
}

/**
 * useNotificationOrchestrator Hook
 */
export function useNotificationOrchestrator(): UseNotificationOrchestratorReturn {
  const { user } = useAuth()
  const orchestratorRef = useRef<NotificationOrchestrator | null>(null)
  const initializingRef = useRef(false)

  const [state, setState] = useState<NotificationOrchestratorState>({
    initialized: false,
    permission: 'default',
    preferences: null,
    scheduledCount: 0,
    queuedCount: 0,
    loading: true,
    error: null
  })

  /**
   * Initialize orchestrator
   */
  useEffect(() => {
    if (!user?.uid || initializingRef.current) return

    const initializeOrchestrator = async () => {
      initializingRef.current = true
      setState(prev => ({ ...prev, loading: true, error: null }))

      try {
        // Get orchestrator instance
        const orchestrator = NotificationOrchestrator.getInstance()
        orchestratorRef.current = orchestrator

        // Initialize for user
        await orchestrator.initialize(user.uid)

        // Check browser permission
        let permission: NotificationPermission = 'default'
        if ('Notification' in window) {
          permission = Notification.permission
        }

        // Get initial stats
        const stats = await orchestrator.getNotificationStats()

        // Set up event listeners
        orchestrator.on('initialized', handleOrchestratorInitialized)
        orchestrator.on('notification:scheduled', handleNotificationScheduled)
        orchestrator.on('notification:sent', handleNotificationSent)
        orchestrator.on('permission:changed', handlePermissionChanged)

        setState(prev => ({
          ...prev,
          initialized: true,
          permission,
          preferences: stats.preferences,
          scheduledCount: stats.scheduled || 0,
          queuedCount: stats.queued || 0,
          loading: false,
          error: null
        }))

        console.log('NotificationOrchestrator initialized for user:', user.uid)
      } catch (error) {
        console.error('Failed to initialize NotificationOrchestrator:', error)
        setState(prev => ({
          ...prev,
          initialized: false,
          loading: false,
          error: error as Error
        }))
      } finally {
        initializingRef.current = false
      }
    }

    initializeOrchestrator()

    // Cleanup on unmount or user change
    return () => {
      if (orchestratorRef.current) {
        orchestratorRef.current.removeAllListeners()
        orchestratorRef.current.cleanup()
        orchestratorRef.current = null
      }
    }
  }, [user?.uid])

  /**
   * Event handlers
   */
  const handleOrchestratorInitialized = useCallback(() => {
    console.log('Orchestrator initialized event received')
  }, [])

  const handleNotificationScheduled = useCallback((data: any) => {
    console.log('Notification scheduled:', data)
    setState(prev => ({
      ...prev,
      scheduledCount: prev.scheduledCount + 1
    }))
  }, [])

  const handleNotificationSent = useCallback((data: any) => {
    console.log('Notification sent:', data)
    setState(prev => ({
      ...prev,
      scheduledCount: Math.max(0, prev.scheduledCount - 1)
    }))
  }, [])

  const handlePermissionChanged = useCallback((permission: NotificationPermission) => {
    console.log('Permission changed:', permission)
    setState(prev => ({
      ...prev,
      permission
    }))
  }, [])

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!orchestratorRef.current) {
      throw new Error('Orchestrator not initialized')
    }

    try {
      const permission = await orchestratorRef.current.requestBrowserPermission()

      setState(prev => ({
        ...prev,
        permission
      }))

      // Track permission request
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'notification_permission_requested', {
          result: permission
        })
      }

      return permission
    } catch (error) {
      console.error('Failed to request permission:', error)
      throw error
    }
  }, [])

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (
    updates: Partial<NotificationPreferences>
  ): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User not authenticated')
    }

    try {
      // Update via API
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error('Failed to update preferences')
      }

      const { preferences } = await response.json()

      setState(prev => ({
        ...prev,
        preferences
      }))

      console.log('Preferences updated:', preferences)
    } catch (error) {
      console.error('Failed to update preferences:', error)
      throw error
    }
  }, [user?.uid])

  /**
   * Send test notification
   */
  const sendTestNotification = useCallback(async (): Promise<void> => {
    if (!orchestratorRef.current) {
      throw new Error('Orchestrator not initialized')
    }

    if (!user?.uid) {
      throw new Error('User not authenticated')
    }

    try {
      await orchestratorRef.current.sendNotification({
        userId: user.uid,
        title: '🔔 Test Notification',
        body: 'This is a test of your notification settings. If you can see this, notifications are working!',
        type: 'achievement',
        channels: ['browser', 'inApp']
      })

      // Track test notification
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'test_notification_sent')
      }
    } catch (error) {
      console.error('Failed to send test notification:', error)
      throw error
    }
  }, [user?.uid])

  /**
   * Get notification statistics
   */
  const getStats = useCallback(async (): Promise<any> => {
    if (!orchestratorRef.current) {
      return null
    }

    try {
      const stats = await orchestratorRef.current.getNotificationStats()

      setState(prev => ({
        ...prev,
        scheduledCount: stats.scheduled || 0,
        queuedCount: stats.queued || 0,
        preferences: stats.preferences
      }))

      return stats
    } catch (error) {
      console.error('Failed to get stats:', error)
      return null
    }
  }, [])

  /**
   * Refresh state
   */
  const refresh = useCallback(async (): Promise<void> => {
    await getStats()
  }, [getStats])

  return {
    ...state,
    requestPermission,
    updatePreferences,
    sendTestNotification,
    getStats,
    refresh
  }
}

/**
 * Hook for managing notification countdown timers
 */
export function useNotificationCountdowns() {
  const [countdowns, setCountdowns] = useState<Map<string, Date>>(new Map())

  useEffect(() => {
    // Listen for countdown events from orchestrator
    const handleCountdownAdd = (event: CustomEvent) => {
      const { itemId, dueDate } = event.detail
      setCountdowns(prev => {
        const next = new Map(prev)
        next.set(itemId, new Date(dueDate))
        return next
      })
    }

    const handleCountdownRemove = (event: CustomEvent) => {
      const { itemId } = event.detail
      setCountdowns(prev => {
        const next = new Map(prev)
        next.delete(itemId)
        return next
      })
    }

    window.addEventListener('countdown:add' as any, handleCountdownAdd)
    window.addEventListener('countdown:remove' as any, handleCountdownRemove)

    return () => {
      window.removeEventListener('countdown:add' as any, handleCountdownAdd)
      window.removeEventListener('countdown:remove' as any, handleCountdownRemove)
    }
  }, [])

  return countdowns
}