'use client'

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { db } from '@/lib/firebase/config'
import type { FeatureReminderKey } from '@/lib/notifications/feature-reminders'

interface UseFeatureReminderToggleResult {
  enabled: boolean
  loading: boolean
  isConfigured: boolean
  canToggle: boolean
  isGlobalDisabled: boolean
  toggle: () => Promise<void>
}

export function useFeatureReminderToggle(featureKey: FeatureReminderKey | null): UseFeatureReminderToggleResult {
  const { user, loading: authLoading } = useAuth()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isGlobalDisabled, setIsGlobalDisabled] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user || !db || !featureKey) {
      setEnabled(true)
      setIsGlobalDisabled(false)
      setLoading(false)
      return
    }

    setLoading(true)
    const docRef = doc(db, 'notifications_preferences', user.uid)
    const unsubscribe = onSnapshot(
      docRef,
      docSnap => {
        const data = docSnap.data() || {}
        const stored = data?.feature_reminders?.features?.[featureKey]
        const channelsEmailEnabled = data?.channels?.email !== false
        const featureRemindersEnabled = data?.feature_reminders?.enabled !== false
        const hasGlobalGateEnabled = channelsEmailEnabled && featureRemindersEnabled

        setEnabled(typeof stored === 'boolean' ? stored : true)
        setIsGlobalDisabled(!hasGlobalGateEnabled)
        setLoading(false)
      },
      error => {
        console.error('Failed to subscribe to feature reminder preference:', error)
        setEnabled(true)
        setIsGlobalDisabled(true)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [authLoading, featureKey, user])

  const toggle = useCallback(async () => {
    if (!user || !db || !featureKey || saving || isGlobalDisabled) return

    const nextValue = !enabled
    setEnabled(nextValue)
    setSaving(true)

    try {
      await setDoc(
        doc(db, 'notifications_preferences', user.uid),
        {
          userId: user.uid,
          feature_reminders: {
            features: {
              [featureKey]: nextValue
            }
          },
          updated_at: new Date().toISOString()
        },
        { merge: true }
      )
    } catch (error) {
      console.error('Failed to update feature reminder preference:', error)
      setEnabled(!nextValue)
    } finally {
      setSaving(false)
    }
  }, [enabled, featureKey, isGlobalDisabled, saving, user])

  return {
    enabled,
    loading: loading || authLoading || saving,
    isConfigured: Boolean(user && featureKey),
    canToggle: Boolean(user && featureKey && !isGlobalDisabled),
    isGlobalDisabled,
    toggle
  }
}
