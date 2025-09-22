import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export interface NotificationPreferences {
  channels: {
    browser: boolean
    inApp: boolean
    push: boolean
    email: boolean
  }
  timing: {
    immediate: boolean
    daily: boolean
    overdue: boolean
  }
  quiet_hours: {
    enabled: boolean
    start: string
    end: string
    timezone: string
  }
  batching: {
    enabled: boolean
    window_minutes: number
  }
}

const defaultPreferences: NotificationPreferences = {
  channels: {
    browser: false,
    inApp: true,
    push: false,
    email: false
  },
  timing: {
    immediate: true,
    daily: true,
    overdue: true
  },
  quiet_hours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  },
  batching: {
    enabled: true,
    window_minutes: 5
  }
}

export function useNotificationPreferences() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPreferences()
    } else {
      setPreferences(defaultPreferences)
      setLoading(false)
    }
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    try {
      setError(null)
      const docRef = doc(db, 'notifications_preferences', user.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as NotificationPreferences
        setPreferences(data)
      } else {
        // Set default preferences for new user
        setPreferences(defaultPreferences)
      }
    } catch (err) {
      console.error('Failed to load notification preferences:', err)
      setError('Failed to load preferences')
      setPreferences(defaultPreferences)
    } finally {
      setLoading(false)
    }
  }

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return false

    setSaving(true)
    setError(null)

    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      await setDoc(docRef, {
        ...newPreferences,
        userId: user.uid,
        updated_at: new Date().toISOString()
      })

      setPreferences(newPreferences)
      return true
    } catch (err) {
      console.error('Failed to save notification preferences:', err)
      setError('Failed to save preferences')
      return false
    } finally {
      setSaving(false)
    }
  }

  const updatePreferences = (updates: Partial<NotificationPreferences>) => {
    const newPreferences = { ...preferences, ...updates }
    setPreferences(newPreferences)
    return newPreferences
  }

  const isInQuietHours = (): boolean => {
    if (!preferences.quiet_hours.enabled) return false

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const [startHour, startMin] = preferences.quiet_hours.start.split(':').map(Number)
    const [endHour, endMin] = preferences.quiet_hours.end.split(':').map(Number)

    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (startTime <= endTime) {
      // Quiet hours don't cross midnight
      return currentTime >= startTime && currentTime < endTime
    } else {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime
    }
  }

  const getQuietHoursEnd = (): Date => {
    const now = new Date()
    const [endHour, endMin] = preferences.quiet_hours.end.split(':').map(Number)

    const endTime = new Date(now)
    endTime.setHours(endHour, endMin, 0, 0)

    // If end time is in the past, add a day
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1)
    }

    return endTime
  }

  return {
    preferences,
    loading,
    saving,
    error,
    savePreferences,
    updatePreferences,
    isInQuietHours,
    getQuietHoursEnd,
    reloadPreferences: loadPreferences
  }
}