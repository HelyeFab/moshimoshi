'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase/client'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { debugLog } from '@/lib/logger'

const logger = debugLog

interface StallItem {
  id: string
  title: string
  subtitle: string
  description: string
  href: string
  icon: string
  stallType: string
  color: string
  glow: string
  doshiMood: 'happy' | 'excited' | 'thinking' | 'waving'
  progress: number
  lanternColor: string
  stallImage: string
}

interface StallOrderState {
  stalls: StallItem[]
  isEditMode: boolean
  isDirty: boolean
  isSaving: boolean
  lastSaved: Date | null
}

const STORAGE_KEY = 'moshimoshi-stall-order'
const FIREBASE_COLLECTION = 'userPreferences'

export function useStallOrder(initialStalls: StallItem[]) {
  const { user } = useAuth()
  const { isPremium } = useSubscription()

  const [state, setState] = useState<StallOrderState>({
    stalls: initialStalls,
    isEditMode: false,
    isDirty: false,
    isSaving: false,
    lastSaved: null
  })

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedOrderRef = useRef<string>('')

  // Load saved order from storage
  const loadSavedOrder = useCallback(async () => {
    try {
      // Try Firebase first for premium users
      if (user?.uid && isPremium) {
        logger.debug('[useStallOrder] Loading from Firebase for premium user')
        const docRef = doc(firestore, FIREBASE_COLLECTION, user.uid)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.stallOrder && Array.isArray(data.stallOrder)) {
            const orderedIds = data.stallOrder as string[]
            const orderedStalls = reorderStalls(initialStalls, orderedIds)
            setState(prev => ({
              ...prev,
              stalls: orderedStalls,
              lastSaved: data.lastUpdated?.toDate() || null
            }))
            lastSavedOrderRef.current = JSON.stringify(orderedIds)
            logger.debug('[useStallOrder] Loaded from Firebase:', orderedIds.length, 'stalls')
            return
          }
        }
      }

      // Fall back to localStorage for free users or if Firebase fails
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { order, timestamp } = JSON.parse(saved)
        const orderedStalls = reorderStalls(initialStalls, order)
        setState(prev => ({
          ...prev,
          stalls: orderedStalls,
          lastSaved: timestamp ? new Date(timestamp) : null
        }))
        lastSavedOrderRef.current = JSON.stringify(order)
        logger.debug('[useStallOrder] Loaded from localStorage:', order.length, 'stalls')
      }
    } catch (error) {
      logger.error('[useStallOrder] Error loading saved order:', error)
    }
  }, [user?.uid, isPremium, initialStalls])

  // Save order to storage
  const saveOrder = useCallback(async (stalls: StallItem[]) => {
    const order = stalls.map(s => s.id)
    const orderString = JSON.stringify(order)

    // Skip if order hasn't changed
    if (orderString === lastSavedOrderRef.current) {
      return
    }

    setState(prev => ({ ...prev, isSaving: true }))

    try {
      const timestamp = new Date()

      // Save to Firebase for premium users
      if (user?.uid && isPremium) {
        logger.debug('[useStallOrder] Saving to Firebase')
        const docRef = doc(firestore, FIREBASE_COLLECTION, user.uid)
        await setDoc(docRef, {
          stallOrder: order,
          lastUpdated: timestamp
        }, { merge: true })
        logger.debug('[useStallOrder] Saved to Firebase successfully')
      }

      // Always save to localStorage as backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        order,
        timestamp: timestamp.toISOString()
      }))

      lastSavedOrderRef.current = orderString
      setState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false,
        lastSaved: timestamp
      }))

    } catch (error) {
      logger.error('[useStallOrder] Error saving order:', error)
      setState(prev => ({ ...prev, isSaving: false }))
    }
  }, [user?.uid, isPremium])

  // Reorder stalls based on saved order
  const reorderStalls = (stalls: StallItem[], order: string[]): StallItem[] => {
    const stallMap = new Map(stalls.map(s => [s.id, s]))
    const ordered: StallItem[] = []

    // Add stalls in saved order
    for (const id of order) {
      const stall = stallMap.get(id)
      if (stall) {
        ordered.push(stall)
        stallMap.delete(id)
      }
    }

    // Add any new stalls that weren't in saved order
    for (const stall of stallMap.values()) {
      ordered.push(stall)
    }

    return ordered
  }

  // Handle reorder
  const handleReorder = useCallback((newStalls: StallItem[]) => {
    setState(prev => ({
      ...prev,
      stalls: newStalls,
      isDirty: true
    }))

    // Debounce save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveOrder(newStalls)
    }, 1000)
  }, [saveOrder])

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    setState(prev => {
      const newEditMode = !prev.isEditMode

      // Save immediately when exiting edit mode if dirty
      if (!newEditMode && prev.isDirty) {
        saveOrder(prev.stalls)
      }

      return {
        ...prev,
        isEditMode: newEditMode
      }
    })
  }, [saveOrder])

  // Reset to default order
  const resetToDefault = useCallback(() => {
    setState(prev => ({
      ...prev,
      stalls: initialStalls,
      isDirty: true
    }))

    // Clear saved order
    localStorage.removeItem(STORAGE_KEY)

    // Clear from Firebase if premium
    if (user?.uid && isPremium) {
      const docRef = doc(firestore, FIREBASE_COLLECTION, user.uid)
      setDoc(docRef, {
        stallOrder: null,
        lastUpdated: new Date()
      }, { merge: true }).catch(err => {
        logger.error('[useStallOrder] Error clearing Firebase order:', err)
      })
    }

    lastSavedOrderRef.current = ''
  }, [initialStalls, user?.uid, isPremium])

  // Load saved order on mount
  useEffect(() => {
    loadSavedOrder()
  }, [loadSavedOrder])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    stalls: state.stalls,
    isEditMode: state.isEditMode,
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    canSync: isPremium,
    handleReorder,
    toggleEditMode,
    resetToDefault
  }
}