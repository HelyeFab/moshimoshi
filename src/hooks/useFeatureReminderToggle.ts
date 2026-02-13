'use client'

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { useAuth } from '@/hooks/useAuth'
import { db, auth as firebaseAuth } from '@/lib/firebase/config'
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
    if (!user || !db || !featureKey || !firebaseAuth) {
      setEnabled(true)
      setIsGlobalDisabled(false)
      setLoading(false)
      return
    }

    setLoading(true)
    let unsubSnapshot: (() => void) | undefined

    // Gate the Firestore subscription on Firebase client auth being ready.
    // The server session (useAuth) can resolve before Firebase client auth
    // initializes, which causes "Missing or insufficient permissions" because
    // Firestore security rules check request.auth (client-side auth state).
    const unsubAuth = onAuthStateChanged(firebaseAuth, fbUser => {
      // Clean up any previous Firestore listener when auth state changes
      if (unsubSnapshot) {
        unsubSnapshot()
        unsubSnapshot = undefined
      }

      if (!fbUser) {
        // Firebase client auth not ready yet — set safe defaults
        setEnabled(true)
        setIsGlobalDisabled(false)
        setLoading(false)
        return
      }

      // Wait for the Firebase Auth ID token to be ready before subscribing
      // to Firestore. Even after onAuthStateChanged fires, the Firestore
      // auth token may not have propagated yet, causing permission errors.
      fbUser.getIdToken().then(() => {
        // Token is now ready — safe to subscribe to Firestore
        const docRef = doc(db, 'notifications_preferences', fbUser.uid)
        unsubSnapshot = onSnapshot(
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
      }).catch(() => {
        // Token fetch failed — set safe defaults
        setEnabled(true)
        setIsGlobalDisabled(false)
        setLoading(false)
      })
    })

    return () => {
      unsubAuth()
      if (unsubSnapshot) {
        unsubSnapshot()
      }
    }
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
