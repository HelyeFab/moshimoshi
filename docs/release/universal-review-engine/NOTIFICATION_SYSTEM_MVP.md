# Moshimoshi Notification System MVP Specification
## Complete Implementation Plan for 4 Parallel Agents

**Version**: 1.0
**Date**: January 2025
**Project**: Moshimoshi - Universal Review Engine Notification System
**Duration**: 3 days (4 agents working in parallel)

---

## Executive Summary

This document specifies the complete implementation of a multi-channel notification system for the Moshimoshi Japanese learning platform. The system will remind users when reviews are due based on the SRS (Spaced Repetition System) algorithm intervals: 10 minutes, 30 minutes, 1 day, and beyond.

### Core Requirements
1. **Browser Notifications**: Desktop web notifications via Notification API
2. **In-App Real-Time Reminders**: Toast notifications within the application
3. **PWA Push Notifications**: Background notifications via Service Worker
4. **Mobile App Support**: iOS/Android PWA notification compatibility

### Success Criteria
- Users receive notifications at exact SRS intervals
- Notifications work offline and sync when online
- Click-through rate to review sessions > 60%
- Zero notification spam (smart batching)
- Full user control via preferences

---

## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Review Engine Events                      │
│  (ITEM_PRESENTED, SESSION_STARTED, PROGRESS_UPDATED)         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Notification Orchestrator Service                │
│  • Event listener registration                               │
│  • Notification scheduling                                   │
│  • User preference checking                                  │
│  • Deduplication & batching                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┬─────────────┬────────────┐
    ▼            ▼            ▼             ▼            ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐
│Browser │ │ In-App   │ │  Push   │ │  Email   │ │Analytics│
│Notify  │ │ Toast    │ │  FCM    │ │ (Resend) │ │Tracking │
└────────┘ └──────────┘ └─────────┘ └──────────┘ └─────────┘
```

### Database Schema Additions

```typescript
// Firestore Collections

// notifications_preferences/{userId}
interface NotificationPreferences {
  userId: string
  channels: {
    browser: boolean
    inApp: boolean
    push: boolean
    email: boolean  // existing
  }
  timing: {
    immediate: boolean      // 10min, 30min reviews
    daily: boolean         // daily summary
    overdue: boolean       // overdue items
  }
  quiet_hours: {
    enabled: boolean
    start: string  // "22:00"
    end: string    // "08:00"
    timezone: string
  }
  batching: {
    enabled: boolean
    window_minutes: number  // batch notifications within X minutes
  }
  updated_at: Timestamp
}

// notifications_queue/{notificationId}
interface NotificationQueue {
  id: string
  userId: string
  type: 'review_due' | 'streak_reminder' | 'achievement' | 'summary'
  channel: 'browser' | 'inApp' | 'push' | 'email'
  scheduled_for: Timestamp
  data: {
    item_ids?: string[]
    review_count?: number
    message: string
    action_url: string
    priority: 'high' | 'normal' | 'low'
  }
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  attempts: number
  created_at: Timestamp
  sent_at?: Timestamp
  error?: string
}

// notifications_tokens/{userId}
interface NotificationTokens {
  userId: string
  fcm_token?: string
  fcm_token_updated?: Timestamp
  browser_permission: 'granted' | 'denied' | 'default'
  browser_permission_updated?: Timestamp
  device_info?: {
    platform: string
    browser: string
    version: string
  }
}
```

---

## Agent Assignments

### Agent 1: Browser Notifications & Core Service
**Focus**: Browser Notification API + Notification Orchestrator
**Time**: Day 1-3
**Dependencies**: None (can start immediately)

### Agent 2: In-App Notifications & UI
**Focus**: Toast system + Settings UI + Real-time timers
**Time**: Day 1-3
**Dependencies**: None (can start immediately)

### Agent 3: Service Worker & PWA Push
**Focus**: Service Worker + FCM + Background sync
**Time**: Day 1-3
**Dependencies**: Agent 1's orchestrator (Day 2)

### Agent 4: Integration & Testing
**Focus**: Review Engine hooks + Testing + Documentation
**Time**: Day 1-3
**Dependencies**: All agents (continuous integration)

---

## Agent 1: Browser Notifications & Core Service

### Deliverables
1. `NotificationOrchestrator` service
2. Browser notification permission flow
3. Notification scheduling system
4. User preference management

### File Structure
```
src/lib/notifications/
├── orchestrator/
│   ├── NotificationOrchestrator.ts
│   ├── NotificationScheduler.ts
│   ├── NotificationQueue.ts
│   └── __tests__/
├── browser/
│   ├── BrowserNotificationService.ts
│   ├── PermissionManager.ts
│   └── __tests__/
├── preferences/
│   ├── PreferenceManager.ts
│   ├── QuietHours.ts
│   └── __tests__/
└── types/
    └── notifications.types.ts
```

### Implementation Details

#### 1.1 NotificationOrchestrator.ts
```typescript
import { EventEmitter } from 'events'
import { ReviewEventType, ReviewEvent } from '@/lib/review-engine/core/events'
import { NotificationScheduler } from './NotificationScheduler'
import { NotificationQueue } from './NotificationQueue'
import { PreferenceManager } from '../preferences/PreferenceManager'
import { BrowserNotificationService } from '../browser/BrowserNotificationService'
import { reviewLogger } from '@/lib/monitoring/logger'

export class NotificationOrchestrator extends EventEmitter {
  private static instance: NotificationOrchestrator
  private scheduler: NotificationScheduler
  private queue: NotificationQueue
  private preferences: PreferenceManager
  private browserService: BrowserNotificationService
  private reviewEngineUnsubscribe?: () => void

  private constructor() {
    super()
    this.scheduler = new NotificationScheduler()
    this.queue = new NotificationQueue()
    this.preferences = new PreferenceManager()
    this.browserService = new BrowserNotificationService()
  }

  static getInstance(): NotificationOrchestrator {
    if (!this.instance) {
      this.instance = new NotificationOrchestrator()
    }
    return this.instance
  }

  async initialize(userId: string): Promise<void> {
    // Load user preferences
    await this.preferences.load(userId)

    // Initialize services
    await this.browserService.initialize()
    await this.queue.initialize(userId)

    // Subscribe to Review Engine events
    this.subscribeToReviewEngine()

    // Process any pending notifications
    await this.processPendingNotifications()

    reviewLogger.info('NotificationOrchestrator initialized', { userId })
  }

  private subscribeToReviewEngine(): void {
    // Listen to Review Engine events
    if (typeof window !== 'undefined') {
      const reviewEngine = (window as any).__REVIEW_ENGINE_INSTANCE__
      if (reviewEngine) {
        reviewEngine.on(ReviewEventType.ITEM_ANSWERED, this.handleItemAnswered.bind(this))
        reviewEngine.on(ReviewEventType.SESSION_COMPLETED, this.handleSessionCompleted.bind(this))
        reviewEngine.on(ReviewEventType.PROGRESS_UPDATED, this.handleProgressUpdated.bind(this))
      }
    }
  }

  private async handleItemAnswered(event: ReviewEvent): Promise<void> {
    const { itemId, correct, nextReviewAt } = event.data

    if (correct && nextReviewAt) {
      // Schedule notification for next review
      await this.scheduleReviewNotification({
        itemId,
        userId: event.userId!,
        reviewAt: nextReviewAt,
        itemType: event.data.contentType
      })
    }
  }

  private async scheduleReviewNotification(params: {
    itemId: string
    userId: string
    reviewAt: Date
    itemType: string
  }): Promise<void> {
    const { itemId, userId, reviewAt, itemType } = params

    // Check user preferences
    const prefs = await this.preferences.getPreferences(userId)
    if (!prefs.channels.browser && !prefs.channels.inApp && !prefs.channels.push) {
      return // No notification channels enabled
    }

    // Calculate delay
    const delay = reviewAt.getTime() - Date.now()

    if (delay <= 0) {
      // Item is already due
      await this.sendImmediateNotification({ itemId, userId, itemType })
    } else if (delay < 60 * 60 * 1000) { // Less than 1 hour
      // Schedule for exact time (10 min, 30 min reviews)
      if (prefs.timing.immediate) {
        await this.scheduler.scheduleNotification({
          userId,
          itemId,
          scheduledFor: reviewAt,
          type: 'review_due',
          priority: 'high'
        })
      }
    } else {
      // Schedule for daily batch
      if (prefs.timing.daily) {
        await this.queue.addToDaily({
          userId,
          itemId,
          dueDate: reviewAt
        })
      }
    }
  }

  async sendNotification(params: {
    userId: string
    title: string
    body: string
    data?: any
    channels?: ('browser' | 'inApp' | 'push')[]
  }): Promise<void> {
    const { userId, title, body, data, channels } = params

    // Check quiet hours
    if (await this.preferences.isInQuietHours(userId)) {
      // Queue for later
      await this.queue.addToQueue({
        ...params,
        scheduledFor: await this.preferences.getQuietHoursEnd(userId)
      })
      return
    }

    // Get enabled channels
    const prefs = await this.preferences.getPreferences(userId)
    const enabledChannels = channels?.filter(ch => prefs.channels[ch]) ||
                           Object.keys(prefs.channels).filter(ch => prefs.channels[ch as keyof typeof prefs.channels])

    // Send to each channel
    const promises = enabledChannels.map(channel => {
      switch (channel) {
        case 'browser':
          return this.browserService.send({ title, body, data })
        case 'inApp':
          return this.sendInAppNotification({ title, body, data })
        case 'push':
          return this.sendPushNotification({ userId, title, body, data })
        default:
          return Promise.resolve()
      }
    })

    await Promise.allSettled(promises)
  }

  // Placeholder for Agent 2's implementation
  private async sendInAppNotification(params: any): Promise<void> {
    this.emit('inApp:notification', params)
  }

  // Placeholder for Agent 3's implementation
  private async sendPushNotification(params: any): Promise<void> {
    this.emit('push:notification', params)
  }

  async cleanup(): void {
    this.reviewEngineUnsubscribe?.()
    await this.scheduler.cleanup()
    await this.queue.cleanup()
  }
}
```

#### 1.2 BrowserNotificationService.ts
```typescript
export class BrowserNotificationService {
  private permission: NotificationPermission = 'default'

  async initialize(): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Browser notifications not supported')
      return
    }

    this.permission = Notification.permission
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied'
    }

    this.permission = await Notification.requestPermission()

    // Store permission in database
    if (typeof window !== 'undefined') {
      const userId = (window as any).__USER_ID__
      if (userId) {
        await this.storePermission(userId, this.permission)
      }
    }

    return this.permission
  }

  async send(params: {
    title: string
    body: string
    icon?: string
    badge?: string
    data?: any
    requireInteraction?: boolean
    actions?: { action: string; title: string }[]
  }): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('Browser notification permission not granted')
      return
    }

    const { title, body, icon = '/icons/icon-192x192.svg', badge, data, requireInteraction = false, actions } = params

    const notification = new Notification(title, {
      body,
      icon,
      badge: badge || '/icons/icon-72x72.svg',
      data,
      requireInteraction,
      actions,
      tag: data?.itemId || 'review-reminder',
      renotify: true,
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    })

    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()

      // Navigate to review page
      if (data?.actionUrl) {
        window.location.href = data.actionUrl
      } else {
        window.location.href = '/review'
      }

      notification.close()
    }

    // Track notification sent
    this.trackNotification('sent', { title, data })
  }

  private async storePermission(userId: string, permission: NotificationPermission): Promise<void> {
    // Store in Firestore
    const { doc, setDoc } = await import('firebase/firestore')
    const { db } = await import('@/lib/firebase/config')

    await setDoc(doc(db, 'notifications_tokens', userId), {
      browser_permission: permission,
      browser_permission_updated: new Date(),
      device_info: {
        platform: navigator.platform,
        browser: navigator.userAgent,
        version: navigator.appVersion
      }
    }, { merge: true })
  }

  private trackNotification(event: string, data: any): void {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', `notification_${event}`, data)
    }
  }
}
```

#### 1.3 NotificationScheduler.ts
```typescript
interface ScheduledNotification {
  id: string
  userId: string
  itemId: string
  scheduledFor: Date
  type: string
  priority: 'high' | 'normal' | 'low'
  timerId?: NodeJS.Timeout
}

export class NotificationScheduler {
  private scheduled: Map<string, ScheduledNotification> = new Map()
  private orchestrator?: any // Will be injected

  setOrchestrator(orchestrator: any): void {
    this.orchestrator = orchestrator
  }

  async scheduleNotification(params: Omit<ScheduledNotification, 'id' | 'timerId'>): Promise<string> {
    const id = `${params.userId}_${params.itemId}_${params.scheduledFor.getTime()}`

    // Cancel existing schedule for this item
    this.cancelNotification(id)

    const delay = params.scheduledFor.getTime() - Date.now()

    if (delay <= 0) {
      // Send immediately
      await this.fireNotification(params)
      return id
    }

    // Schedule for future
    const timerId = setTimeout(async () => {
      await this.fireNotification(params)
      this.scheduled.delete(id)
    }, delay)

    const scheduled: ScheduledNotification = {
      id,
      ...params,
      timerId
    }

    this.scheduled.set(id, scheduled)

    // Persist to database for recovery
    await this.persistSchedule(scheduled)

    return id
  }

  private async fireNotification(params: Omit<ScheduledNotification, 'id' | 'timerId'>): Promise<void> {
    if (!this.orchestrator) return

    // Fetch item details
    const itemDetails = await this.fetchItemDetails(params.itemId)

    // Send notification
    await this.orchestrator.sendNotification({
      userId: params.userId,
      title: this.getNotificationTitle(params.type, itemDetails),
      body: this.getNotificationBody(params.type, itemDetails),
      data: {
        itemId: params.itemId,
        type: params.type,
        actionUrl: `/review?item=${params.itemId}`
      }
    })
  }

  private getNotificationTitle(type: string, item: any): string {
    switch (type) {
      case 'review_due':
        return `Time to review: ${item.primaryDisplay}`
      case 'overdue':
        return `⚠️ Overdue review: ${item.primaryDisplay}`
      default:
        return 'Review reminder'
    }
  }

  private getNotificationBody(type: string, item: any): string {
    switch (type) {
      case 'review_due':
        return `Your ${item.contentType} review is ready. Don't break your streak!`
      case 'overdue':
        return `This ${item.contentType} is overdue. Review it now to strengthen your memory.`
      default:
        return 'Tap to start your review session'
    }
  }

  cancelNotification(id: string): void {
    const scheduled = this.scheduled.get(id)
    if (scheduled?.timerId) {
      clearTimeout(scheduled.timerId)
      this.scheduled.delete(id)
    }
  }

  async cleanup(): Promise<void> {
    // Cancel all scheduled notifications
    for (const [id, scheduled] of this.scheduled.entries()) {
      if (scheduled.timerId) {
        clearTimeout(scheduled.timerId)
      }
    }
    this.scheduled.clear()
  }

  private async persistSchedule(scheduled: ScheduledNotification): Promise<void> {
    // Store in IndexedDB for persistence
    const db = await this.openIndexedDB()
    const tx = db.transaction(['scheduled_notifications'], 'readwrite')
    await tx.objectStore('scheduled_notifications').put(scheduled)
  }

  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('moshimoshi_notifications', 1)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('scheduled_notifications')) {
          db.createObjectStore('scheduled_notifications', { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  private async fetchItemDetails(itemId: string): Promise<any> {
    // Fetch from review engine or cache
    // This would connect to the actual data source
    return {
      primaryDisplay: 'あ',
      contentType: 'hiragana',
      meaning: 'a'
    }
  }
}
```

---

## Agent 2: In-App Notifications & UI

### Deliverables
1. In-app notification toast system
2. Real-time countdown timers
3. Settings UI for preferences
4. Notification center component

### File Structure
```
src/components/notifications/
├── InAppNotificationProvider.tsx
├── NotificationToast.tsx
├── ReviewCountdown.tsx
├── NotificationCenter.tsx
├── NotificationSettings.tsx
└── __tests__/

src/hooks/
├── useInAppNotifications.ts
├── useReviewCountdown.ts
└── useNotificationPreferences.ts
```

### Implementation Details

#### 2.1 InAppNotificationProvider.tsx
```typescript
'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { NotificationToast } from './NotificationToast'
import { ReviewCountdown } from './ReviewCountdown'
import { useAuth } from '@/hooks/useAuth'
import { reviewLogger } from '@/lib/monitoring/logger'

interface InAppNotification {
  id: string
  title: string
  body: string
  type: 'info' | 'success' | 'warning' | 'review_due'
  actionUrl?: string
  countdown?: number // seconds until auto-dismiss
  persistent?: boolean
  timestamp: Date
}

interface InAppNotificationContextType {
  notifications: InAppNotification[]
  countdowns: Map<string, Date> // itemId -> dueDate
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  addCountdown: (itemId: string, dueDate: Date) => void
  removeCountdown: (itemId: string) => void
  clearAll: () => void
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined)

export function InAppNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [countdowns, setCountdowns] = useState<Map<string, Date>>(new Map())
  const orchestratorRef = useRef<any>(null)
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    if (!user) return

    // Initialize orchestrator connection
    initializeOrchestrator()

    // Load persisted countdowns
    loadPersistedCountdowns()

    return () => {
      // Cleanup timers
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [user])

  const initializeOrchestrator = async () => {
    const { NotificationOrchestrator } = await import('@/lib/notifications/orchestrator/NotificationOrchestrator')
    const orchestrator = NotificationOrchestrator.getInstance()

    // Listen for in-app notifications
    orchestrator.on('inApp:notification', handleInAppNotification)
    orchestratorRef.current = orchestrator
  }

  const handleInAppNotification = useCallback((params: any) => {
    addNotification({
      title: params.title,
      body: params.body,
      type: 'review_due',
      actionUrl: params.data?.actionUrl,
      persistent: true
    })
  }, [])

  const addNotification = useCallback((notification: Omit<InAppNotification, 'id' | 'timestamp'>) => {
    const id = `${Date.now()}_${Math.random()}`
    const newNotification: InAppNotification = {
      ...notification,
      id,
      timestamp: new Date()
    }

    setNotifications(prev => [...prev, newNotification])

    // Auto-dismiss if not persistent
    if (!notification.persistent) {
      const timeout = notification.countdown || 5000
      const timerId = setTimeout(() => {
        removeNotification(id)
      }, timeout)

      timersRef.current.set(id, timerId)
    }

    // Play sound for review_due
    if (notification.type === 'review_due') {
      playNotificationSound()
    }

    reviewLogger.info('In-app notification added', { notification: newNotification })
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))

    // Clear timer if exists
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addCountdown = useCallback((itemId: string, dueDate: Date) => {
    setCountdowns(prev => {
      const next = new Map(prev)
      next.set(itemId, dueDate)
      return next
    })

    // Persist to localStorage
    persistCountdowns()

    // Schedule notification for due date
    const delay = dueDate.getTime() - Date.now()
    if (delay > 0 && delay < 60 * 60 * 1000) { // Less than 1 hour
      const timerId = setTimeout(() => {
        addNotification({
          title: 'Review Due!',
          body: `Time to review item ${itemId}`,
          type: 'review_due',
          actionUrl: `/review?item=${itemId}`,
          persistent: true
        })
        removeCountdown(itemId)
      }, delay)

      timersRef.current.set(`countdown_${itemId}`, timerId)
    }
  }, [addNotification])

  const removeCountdown = useCallback((itemId: string) => {
    setCountdowns(prev => {
      const next = new Map(prev)
      next.delete(itemId)
      return next
    })

    // Clear timer if exists
    const timer = timersRef.current.get(`countdown_${itemId}`)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(`countdown_${itemId}`)
    }

    persistCountdowns()
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setCountdowns(new Map())

    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer))
    timersRef.current.clear()
  }, [])

  const persistCountdowns = () => {
    if (typeof window === 'undefined') return

    const data = Array.from(countdowns.entries()).map(([itemId, dueDate]) => ({
      itemId,
      dueDate: dueDate.toISOString()
    }))

    localStorage.setItem('review_countdowns', JSON.stringify(data))
  }

  const loadPersistedCountdowns = () => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem('review_countdowns')
      if (stored) {
        const data = JSON.parse(stored)
        const now = Date.now()

        data.forEach((item: any) => {
          const dueDate = new Date(item.dueDate)
          if (dueDate.getTime() > now) {
            addCountdown(item.itemId, dueDate)
          }
        })
      }
    } catch (error) {
      console.error('Failed to load persisted countdowns:', error)
    }
  }

  const playNotificationSound = () => {
    if (typeof window === 'undefined') return

    try {
      const audio = new Audio('/sounds/notification.mp3')
      audio.volume = 0.5
      audio.play().catch(e => console.warn('Could not play notification sound:', e))
    } catch (error) {
      console.warn('Audio not supported:', error)
    }
  }

  return (
    <InAppNotificationContext.Provider
      value={{
        notifications,
        countdowns,
        addNotification,
        removeNotification,
        addCountdown,
        removeCountdown,
        clearAll
      }}
    >
      {children}

      {/* Notification container */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map(notification => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={() => removeNotification(notification.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Countdown timers */}
      <div className="fixed bottom-4 right-4 z-40 space-y-2">
        <AnimatePresence>
          {Array.from(countdowns.entries())
            .filter(([_, dueDate]) => dueDate.getTime() - Date.now() < 60 * 60 * 1000) // Show if less than 1 hour
            .map(([itemId, dueDate]) => (
              <ReviewCountdown
                key={itemId}
                itemId={itemId}
                dueDate={dueDate}
                onComplete={() => removeCountdown(itemId)}
              />
            ))}
        </AnimatePresence>
      </div>
    </InAppNotificationContext.Provider>
  )
}

export function useInAppNotifications() {
  const context = useContext(InAppNotificationContext)
  if (!context) {
    throw new Error('useInAppNotifications must be used within InAppNotificationProvider')
  }
  return context
}
```

#### 2.2 NotificationToast.tsx
```typescript
'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { X, AlertCircle, CheckCircle, Info, Clock } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface NotificationToastProps {
  notification: {
    id: string
    title: string
    body: string
    type: 'info' | 'success' | 'warning' | 'review_due'
    actionUrl?: string
    persistent?: boolean
    timestamp: Date
  }
  onDismiss: () => void
}

export function NotificationToast({ notification, onDismiss }: NotificationToastProps) {
  const icons = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    review_due: <Clock className="w-5 h-5" />
  }

  const colors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800',
    review_due: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'relative w-80 p-4 rounded-lg border shadow-lg pointer-events-auto',
        colors[notification.type]
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[notification.type]}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">
            {notification.title}
          </h4>
          <p className="mt-1 text-sm opacity-90">
            {notification.body}
          </p>

          {notification.actionUrl && (
            <Link
              href={notification.actionUrl}
              className="inline-block mt-2 text-sm font-medium underline hover:no-underline"
              onClick={onDismiss}
            >
              Go to review →
            </Link>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {!notification.persistent && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 5, ease: 'linear' }}
          className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-30 origin-left"
        />
      )}
    </motion.div>
  )
}
```

#### 2.3 ReviewCountdown.tsx
```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Play } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ReviewCountdownProps {
  itemId: string
  dueDate: Date
  onComplete: () => void
}

export function ReviewCountdown({ itemId, dueDate, onComplete }: ReviewCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isOverdue, setIsOverdue] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      const diff = dueDate.getTime() - now

      if (diff <= 0) {
        setIsOverdue(true)
        setTimeLeft('Due now!')
        onComplete()
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [dueDate, onComplete])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        'flex items-center gap-3 px-4 py-2 rounded-lg backdrop-blur-sm',
        isOverdue
          ? 'bg-red-500/90 text-white'
          : 'bg-gray-900/90 text-white dark:bg-gray-100/90 dark:text-gray-900'
      )}
    >
      <Clock className={cn('w-5 h-5', isOverdue && 'animate-pulse')} />

      <div className="flex-1">
        <div className="text-xs opacity-75">Next review</div>
        <div className="font-mono font-semibold">{timeLeft}</div>
      </div>

      {isOverdue && (
        <Link
          href={`/review?item=${itemId}`}
          className="flex items-center gap-1 px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span className="text-sm">Start</span>
        </Link>
      )}
    </motion.div>
  )
}
```

#### 2.4 NotificationSettings.tsx
```typescript
'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, Clock, Moon, Volume2, Smartphone } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export function NotificationSettings() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [preferences, setPreferences] = useState({
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
  })

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (user) {
      loadPreferences()
      checkBrowserPermission()
    }
  }, [user])

  const loadPreferences = async () => {
    if (!user) return

    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        setPreferences(docSnap.data() as any)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkBrowserPermission = () => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission)
    }
  }

  const savePreferences = async () => {
    if (!user) return

    setSaving(true)
    try {
      const docRef = doc(db, 'notifications_preferences', user.uid)
      await setDoc(docRef, {
        ...preferences,
        userId: user.uid,
        updated_at: new Date()
      })

      showToast('Notification preferences saved', 'success')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      showToast('Failed to save preferences', 'error')
    } finally {
      setSaving(false)
    }
  }

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      showToast('Browser notifications not supported', 'error')
      return
    }

    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)

    if (permission === 'granted') {
      setPreferences(prev => ({
        ...prev,
        channels: { ...prev.channels, browser: true }
      }))
      showToast('Browser notifications enabled', 'success')
    } else if (permission === 'denied') {
      showToast('Browser notifications blocked. Please enable in browser settings.', 'error')
    }
  }

  const testNotification = async () => {
    const { BrowserNotificationService } = await import('@/lib/notifications/browser/BrowserNotificationService')
    const service = new BrowserNotificationService()
    await service.initialize()

    await service.send({
      title: 'Test Notification',
      body: 'This is a test of your notification settings',
      requireInteraction: true
    })
  }

  if (loading) {
    return <div>Loading preferences...</div>
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notification Channels
        </h3>

        <div className="space-y-4">
          {/* Browser Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="browser-notifications">Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Desktop notifications when reviews are due
              </p>
            </div>
            {browserPermission === 'default' ? (
              <Button
                onClick={requestBrowserPermission}
                variant="outline"
                size="sm"
              >
                Enable
              </Button>
            ) : browserPermission === 'granted' ? (
              <Switch
                id="browser-notifications"
                checked={preferences.channels.browser}
                onCheckedChange={(checked) =>
                  setPreferences(prev => ({
                    ...prev,
                    channels: { ...prev.channels, browser: checked }
                  }))
                }
              />
            ) : (
              <span className="text-sm text-red-500">Blocked</span>
            )}
          </div>

          {/* In-App Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="in-app-notifications">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Toast notifications while using the app
              </p>
            </div>
            <Switch
              id="in-app-notifications"
              checked={preferences.channels.inApp}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  channels: { ...prev.channels, inApp: checked }
                }))
              }
            />
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="push-notifications" className="flex items-center gap-1">
                Push Notifications
                <Smartphone className="w-4 h-4" />
              </Label>
              <p className="text-sm text-muted-foreground">
                Mobile notifications (requires app install)
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={preferences.channels.push}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  channels: { ...prev.channels, push: checked }
                }))
              }
            />
          </div>

          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="email-notifications">Email Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Daily study reminders via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={preferences.channels.email}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  channels: { ...prev.channels, email: checked }
                }))
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Timing Preferences
        </h3>

        <div className="space-y-4">
          {/* Immediate Reviews */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="immediate-reviews">Immediate Reviews</Label>
              <p className="text-sm text-muted-foreground">
                Notify for 10-minute and 30-minute reviews
              </p>
            </div>
            <Switch
              id="immediate-reviews"
              checked={preferences.timing.immediate}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  timing: { ...prev.timing, immediate: checked }
                }))
              }
            />
          </div>

          {/* Daily Reviews */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="daily-reviews">Daily Summary</Label>
              <p className="text-sm text-muted-foreground">
                Get a daily summary of reviews due
              </p>
            </div>
            <Switch
              id="daily-reviews"
              checked={preferences.timing.daily}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  timing: { ...prev.timing, daily: checked }
                }))
              }
            />
          </div>

          {/* Overdue Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="overdue-notifications">Overdue Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Extra reminders for overdue items
              </p>
            </div>
            <Switch
              id="overdue-notifications"
              checked={preferences.timing.overdue}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  timing: { ...prev.timing, overdue: checked }
                }))
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          Quiet Hours
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="quiet-hours">Enable Quiet Hours</Label>
              <p className="text-sm text-muted-foreground">
                No notifications during specified times
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={preferences.quiet_hours.enabled}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({
                  ...prev,
                  quiet_hours: { ...prev.quiet_hours, enabled: checked }
                }))
              }
            />
          </div>

          {preferences.quiet_hours.enabled && (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="quiet-start">Start Time</Label>
                <input
                  id="quiet-start"
                  type="time"
                  value={preferences.quiet_hours.start}
                  onChange={(e) =>
                    setPreferences(prev => ({
                      ...prev,
                      quiet_hours: { ...prev.quiet_hours, start: e.target.value }
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>

              <div className="flex-1">
                <Label htmlFor="quiet-end">End Time</Label>
                <input
                  id="quiet-end"
                  type="time"
                  value={preferences.quiet_hours.end}
                  onChange={(e) =>
                    setPreferences(prev => ({
                      ...prev,
                      quiet_hours: { ...prev.quiet_hours, end: e.target.value }
                    }))
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={savePreferences}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>

        <Button
          onClick={testNotification}
          variant="outline"
          disabled={!preferences.channels.browser || browserPermission !== 'granted'}
        >
          <Volume2 className="w-4 h-4 mr-2" />
          Test Notification
        </Button>
      </div>
    </div>
  )
}
```

---

## Agent 3: Service Worker & PWA Push

### Deliverables
1. Service Worker with notification handling
2. Firebase Cloud Messaging setup
3. Background sync for offline notifications
4. Push notification handlers

### File Structure
```
public/
├── sw.js
├── firebase-messaging-sw.js
└── sounds/
    └── notification.mp3

src/lib/notifications/
├── push/
│   ├── PushNotificationService.ts
│   ├── FCMManager.ts
│   ├── ServiceWorkerManager.ts
│   └── __tests__/
└── workers/
    └── notification.worker.ts
```

### Implementation Details

#### 3.1 Service Worker (public/sw.js)
```javascript
// Service Worker for Moshimoshi PWA
const CACHE_NAME = 'moshimoshi-v1'
const NOTIFICATION_TAG = 'review-reminder'

// Cache assets
const urlsToCache = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/sounds/notification.mp3'
]

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  // Network first, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response before caching
        const responseToCache = response.clone()

        caches.open(CACHE_NAME)
          .then((cache) => {
            // Only cache GET requests
            if (event.request.method === 'GET') {
              cache.put(event.request, responseToCache)
            }
          })

        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response
            }

            // Return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/offline')
            }

            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            })
          })
      })
  )
})

// Push event
self.addEventListener('push', (event) => {
  const options = event.data ? event.data.json() : {}

  const notificationOptions = {
    body: options.body || 'You have reviews waiting!',
    icon: options.icon || '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [200, 100, 200],
    data: options.data || {},
    actions: options.actions || [
      { action: 'review', title: 'Start Review' },
      { action: 'later', title: 'Remind Later' }
    ],
    tag: NOTIFICATION_TAG,
    renotify: true,
    requireInteraction: true
  }

  event.waitUntil(
    self.registration.showNotification(
      options.title || 'Review Reminder',
      notificationOptions
    )
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  let targetUrl = '/'

  if (event.action === 'review') {
    targetUrl = '/review'
  } else if (event.action === 'later') {
    // Schedule for 30 minutes later
    scheduleNotification(30 * 60 * 1000)
    return
  } else if (event.notification.data && event.notification.data.actionUrl) {
    targetUrl = event.notification.data.actionUrl
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a tab open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }

        // Open new tab if none exist
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'review-notifications') {
    event.waitUntil(syncNotifications())
  }
})

// Message event for client communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleNotification(event.data.delay, event.data.notification)
  } else if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    cancelScheduledNotification(event.data.id)
  }
})

// Scheduled notifications storage
const scheduledNotifications = new Map()

function scheduleNotification(delay, notification) {
  const id = Date.now().toString()

  const timeoutId = setTimeout(() => {
    self.registration.showNotification(
      notification.title,
      notification.options
    )
    scheduledNotifications.delete(id)
  }, delay)

  scheduledNotifications.set(id, timeoutId)

  // Store in IndexedDB for persistence
  storeScheduledNotification(id, Date.now() + delay, notification)

  return id
}

function cancelScheduledNotification(id) {
  const timeoutId = scheduledNotifications.get(id)
  if (timeoutId) {
    clearTimeout(timeoutId)
    scheduledNotifications.delete(id)
  }

  // Remove from IndexedDB
  removeStoredNotification(id)
}

// IndexedDB operations
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('notifications_db', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('scheduled')) {
        db.createObjectStore('scheduled', { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeScheduledNotification(id, time, notification) {
  try {
    const db = await openDB()
    const tx = db.transaction(['scheduled'], 'readwrite')
    const store = tx.objectStore('scheduled')

    store.put({
      id,
      time,
      notification
    })

    await tx.complete
  } catch (error) {
    console.error('Failed to store scheduled notification:', error)
  }
}

async function removeStoredNotification(id) {
  try {
    const db = await openDB()
    const tx = db.transaction(['scheduled'], 'readwrite')
    const store = tx.objectStore('scheduled')

    store.delete(id)

    await tx.complete
  } catch (error) {
    console.error('Failed to remove stored notification:', error)
  }
}

async function syncNotifications() {
  try {
    // Fetch pending notifications from server
    const response = await fetch('/api/notifications/pending', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const notifications = await response.json()

      // Show notifications
      for (const notification of notifications) {
        await self.registration.showNotification(
          notification.title,
          notification.options
        )
      }
    }
  } catch (error) {
    console.error('Failed to sync notifications:', error)
    throw error // Retry sync
  }
}

// Restore scheduled notifications on service worker restart
async function restoreScheduledNotifications() {
  try {
    const db = await openDB()
    const tx = db.transaction(['scheduled'], 'readonly')
    const store = tx.objectStore('scheduled')
    const notifications = await store.getAll()

    const now = Date.now()

    for (const item of notifications) {
      if (item.time > now) {
        // Reschedule future notifications
        scheduleNotification(item.time - now, item.notification)
      } else {
        // Show overdue notifications immediately
        self.registration.showNotification(
          item.notification.title,
          item.notification.options
        )
        removeStoredNotification(item.id)
      }
    }
  } catch (error) {
    console.error('Failed to restore scheduled notifications:', error)
  }
}

// Restore on startup
restoreScheduledNotifications()
```

#### 3.2 Firebase Messaging Service Worker (public/firebase-messaging-sw.js)
```javascript
// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js')

// Initialize Firebase
firebase.initializeApp({
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
})

const messaging = firebase.messaging()

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload)

  const { title, body, icon, badge, data } = payload.notification || {}

  const notificationOptions = {
    body: body || 'You have new reviews!',
    icon: icon || '/icons/icon-192x192.svg',
    badge: badge || '/icons/icon-72x72.svg',
    data: data || {},
    vibrate: [200, 100, 200],
    actions: [
      { action: 'review', title: 'Start Review' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: 'fcm-notification',
    renotify: true
  }

  return self.registration.showNotification(
    title || 'Moshimoshi',
    notificationOptions
  )
})
```

#### 3.3 FCMManager.ts
```typescript
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { reviewLogger } from '@/lib/monitoring/logger'

export class FCMManager {
  private static instance: FCMManager
  private messaging: Messaging | null = null
  private token: string | null = null
  private unsubscribe: (() => void) | null = null

  private constructor() {}

  static getInstance(): FCMManager {
    if (!this.instance) {
      this.instance = new FCMManager()
    }
    return this.instance
  }

  async initialize(): Promise<void> {
    if (!this.isSupported()) {
      reviewLogger.warn('FCM not supported in this environment')
      return
    }

    try {
      // Initialize Firebase Messaging
      const app = initializeApp({
        // Firebase config
      })

      this.messaging = getMessaging(app)

      // Register service worker
      await this.registerServiceWorker()

      // Get FCM token
      await this.getToken()

      // Listen for foreground messages
      this.listenForMessages()

      reviewLogger.info('FCM initialized successfully')
    } catch (error) {
      reviewLogger.error('Failed to initialize FCM:', error)
      throw error
    }
  }

  private async registerServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        // Register main service worker
        const registration = await navigator.serviceWorker.register('/sw.js')
        reviewLogger.info('Service Worker registered:', registration)

        // Register Firebase messaging service worker
        await navigator.serviceWorker.register('/firebase-messaging-sw.js')
        reviewLogger.info('Firebase Messaging SW registered')
      } catch (error) {
        reviewLogger.error('Service Worker registration failed:', error)
        throw error
      }
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.messaging) {
      throw new Error('FCM not initialized')
    }

    try {
      const currentToken = await getToken(this.messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      })

      if (currentToken) {
        this.token = currentToken
        await this.saveToken(currentToken)
        reviewLogger.info('FCM token obtained')
        return currentToken
      } else {
        reviewLogger.warn('No FCM token available')
        return null
      }
    } catch (error) {
      reviewLogger.error('Failed to get FCM token:', error)
      throw error
    }
  }

  private async saveToken(token: string): Promise<void> {
    // Save token to Firestore
    const userId = (window as any).__USER_ID__
    if (!userId) return

    try {
      await setDoc(doc(db, 'notifications_tokens', userId), {
        fcm_token: token,
        fcm_token_updated: new Date(),
        platform: this.getPlatform(),
        last_active: new Date()
      }, { merge: true })

      reviewLogger.info('FCM token saved to database')
    } catch (error) {
      reviewLogger.error('Failed to save FCM token:', error)
    }
  }

  private listenForMessages(): void {
    if (!this.messaging) return

    this.unsubscribe = onMessage(this.messaging, (payload) => {
      reviewLogger.info('Foreground message received:', payload)

      // Emit event for in-app handling
      const event = new CustomEvent('fcm:message', {
        detail: payload
      })
      window.dispatchEvent(event)

      // Show notification if page is not visible
      if (document.hidden) {
        this.showNotification(payload)
      }
    })
  }

  private async showNotification(payload: any): Promise<void> {
    const { title, body, icon, data } = payload.notification || {}

    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title || 'Moshimoshi', {
        body: body || 'You have new reviews!',
        icon: icon || '/icons/icon-192x192.svg',
        badge: '/icons/icon-72x72.svg',
        data: data || {},
        tag: 'fcm-foreground',
        renotify: true
      })

      notification.onclick = () => {
        window.focus()
        if (data?.actionUrl) {
          window.location.href = data.actionUrl
        }
        notification.close()
      }
    }
  }

  async sendToDevice(params: {
    token: string
    title: string
    body: string
    data?: any
  }): Promise<void> {
    // Call server API to send FCM message
    const response = await fetch('/api/notifications/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      throw new Error('Failed to send push notification')
    }
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' &&
           'Notification' in window &&
           'serviceWorker' in navigator &&
           'PushManager' in window
  }

  private getPlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase()

    if (userAgent.includes('android')) return 'android'
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
    if (userAgent.includes('windows')) return 'windows'
    if (userAgent.includes('mac')) return 'macos'
    if (userAgent.includes('linux')) return 'linux'

    return 'unknown'
  }

  async cleanup(): Promise<void> {
    this.unsubscribe?.()
  }
}
```

---

## Agent 4: Integration & Testing

### Deliverables
1. Review Engine integration hooks
2. API endpoints for notification management
3. End-to-end tests
4. Documentation

### File Structure
```
src/
├── app/api/notifications/
│   ├── send-push/route.ts
│   ├── pending/route.ts
│   ├── preferences/route.ts
│   └── test/route.ts
├── hooks/
│   └── useNotificationIntegration.ts
├── __tests__/
│   └── e2e/
│       └── notifications.test.ts
└── docs/
    └── NOTIFICATIONS.md
```

### Implementation Details

#### 4.1 Review Engine Integration Hook
```typescript
// src/hooks/useNotificationIntegration.ts

import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { NotificationOrchestrator } from '@/lib/notifications/orchestrator/NotificationOrchestrator'
import { FCMManager } from '@/lib/notifications/push/FCMManager'
import { useInAppNotifications } from '@/components/notifications/InAppNotificationProvider'
import { reviewLogger } from '@/lib/monitoring/logger'

export function useNotificationIntegration() {
  const { user } = useAuth()
  const { addCountdown } = useInAppNotifications()
  const orchestratorRef = useRef<NotificationOrchestrator | null>(null)
  const fcmManagerRef = useRef<FCMManager | null>(null)

  useEffect(() => {
    if (!user) return

    let cleanup: (() => void) | undefined

    const initialize = async () => {
      try {
        // Initialize orchestrator
        const orchestrator = NotificationOrchestrator.getInstance()
        await orchestrator.initialize(user.uid)
        orchestratorRef.current = orchestrator

        // Initialize FCM
        const fcmManager = FCMManager.getInstance()
        await fcmManager.initialize()
        fcmManagerRef.current = fcmManager

        // Connect to Review Engine
        connectToReviewEngine()

        reviewLogger.info('Notification integration initialized')
      } catch (error) {
        reviewLogger.error('Failed to initialize notification integration:', error)
      }
    }

    const connectToReviewEngine = () => {
      // Listen for Review Engine events
      const handleReviewScheduled = (event: CustomEvent) => {
        const { itemId, nextReviewAt } = event.detail

        // Add countdown for immediate reviews (< 1 hour)
        const delay = new Date(nextReviewAt).getTime() - Date.now()
        if (delay > 0 && delay < 60 * 60 * 1000) {
          addCountdown(itemId, new Date(nextReviewAt))
        }
      }

      window.addEventListener('review:scheduled', handleReviewScheduled as EventListener)

      cleanup = () => {
        window.removeEventListener('review:scheduled', handleReviewScheduled as EventListener)
      }
    }

    initialize()

    return () => {
      cleanup?.()
      orchestratorRef.current?.cleanup()
      fcmManagerRef.current?.cleanup()
    }
  }, [user, addCountdown])

  const scheduleNotification = async (itemId: string, reviewAt: Date) => {
    if (!orchestratorRef.current || !user) return

    await orchestratorRef.current.scheduleReviewNotification({
      itemId,
      userId: user.uid,
      reviewAt,
      itemType: 'review'
    })
  }

  const sendTestNotification = async () => {
    if (!orchestratorRef.current || !user) return

    await orchestratorRef.current.sendNotification({
      userId: user.uid,
      title: 'Test Notification',
      body: 'This is a test of the notification system',
      channels: ['browser', 'inApp', 'push']
    })
  }

  return {
    scheduleNotification,
    sendTestNotification
  }
}
```

#### 4.2 API Endpoints

```typescript
// src/app/api/notifications/send-push/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { adminDb, adminMessaging } from '@/lib/firebase/admin'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token, title, body, data } = await request.json()

    // Validate input
    if (!token || !title) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Send FCM message
    const message = {
      token,
      notification: {
        title,
        body: body || 'You have new reviews!'
      },
      data: data || {},
      webpush: {
        fcmOptions: {
          link: data?.actionUrl || `${process.env.NEXT_PUBLIC_APP_URL}/review`
        },
        notification: {
          icon: '/icons/icon-192x192.svg',
          badge: '/icons/icon-72x72.svg',
          vibrate: [200, 100, 200],
          requireInteraction: true
        }
      }
    }

    const response = await adminMessaging.send(message)

    // Log notification sent
    await adminDb.collection('notifications_log').add({
      userId: session.user.id,
      type: 'push',
      messageId: response,
      sentAt: new Date(),
      title,
      body,
      data
    })

    return NextResponse.json({ success: true, messageId: response })
  } catch (error) {
    console.error('Failed to send push notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
```

#### 4.3 E2E Tests

```typescript
// src/__tests__/e2e/notifications.test.ts

import { test, expect } from '@playwright/test'

test.describe('Notification System', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications'])

    // Login
    await page.goto('/auth/signin')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'password')
    await page.click('[type="submit"]')

    await page.waitForURL('/dashboard')
  })

  test('should request browser notification permission', async ({ page }) => {
    await page.goto('/settings')

    // Find notification settings
    const browserNotificationToggle = page.locator('text=Browser Notifications')
    await expect(browserNotificationToggle).toBeVisible()

    // Should show permission button
    const enableButton = page.locator('button:has-text("Enable")')
    await expect(enableButton).toBeVisible()
  })

  test('should show in-app notification for due review', async ({ page }) => {
    // Start a review session
    await page.goto('/review')

    // Complete an item
    await page.click('[data-test="answer-button"]')

    // Should schedule next review
    await page.waitForTimeout(1000)

    // Check for countdown timer
    const countdown = page.locator('[data-test="review-countdown"]')
    await expect(countdown).toBeVisible()
  })

  test('should receive notification after review interval', async ({ page }) => {
    // Mock time to speed up test
    await page.addInitScript(() => {
      const originalDate = Date
      let mockTime = Date.now()

      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            super(mockTime)
          } else {
            super(...args)
          }
        }

        static now() {
          return mockTime
        }
      }

      global.__advanceTime = (ms) => {
        mockTime += ms
      }
    })

    // Complete a review
    await page.goto('/review')
    await page.click('[data-test="start-review"]')
    await page.fill('[data-test="answer-input"]', 'answer')
    await page.click('[data-test="submit-answer"]')

    // Advance time by 10 minutes
    await page.evaluate(() => {
      (window as any).__advanceTime(10 * 60 * 1000)
    })

    // Check for notification
    await page.waitForTimeout(1000)
    const notification = page.locator('[data-test="notification-toast"]')
    await expect(notification).toBeVisible()
    await expect(notification).toContainText('Time to review')
  })

  test('should batch notifications within time window', async ({ page }) => {
    await page.goto('/settings')

    // Enable batching
    await page.click('[data-test="batching-enabled"]')
    await page.fill('[data-test="batching-window"]', '5')
    await page.click('[data-test="save-preferences"]')

    // Trigger multiple reviews
    await page.goto('/review')

    // Complete multiple items quickly
    for (let i = 0; i < 3; i++) {
      await page.click('[data-test="answer-button"]')
      await page.waitForTimeout(100)
    }

    // Should receive single batched notification
    await page.waitForTimeout(1000)
    const notifications = page.locator('[data-test="notification-toast"]')
    await expect(notifications).toHaveCount(1)
    await expect(notifications).toContainText('3 reviews')
  })

  test('should respect quiet hours', async ({ page }) => {
    await page.goto('/settings')

    // Set quiet hours
    await page.click('[data-test="quiet-hours-enabled"]')
    await page.fill('[data-test="quiet-hours-start"]', '22:00')
    await page.fill('[data-test="quiet-hours-end"]', '08:00')
    await page.click('[data-test="save-preferences"]')

    // Mock current time to be within quiet hours
    await page.evaluate(() => {
      const now = new Date()
      now.setHours(23, 0, 0, 0)
      global.Date = class extends Date {
        constructor() {
          super()
          return now
        }
      }
    })

    // Try to send test notification
    await page.click('[data-test="test-notification"]')

    // Should not show notification
    await page.waitForTimeout(1000)
    const notification = page.locator('[data-test="notification-toast"]')
    await expect(notification).not.toBeVisible()
  })
})
```

---

## Integration Points & Data Flow

### Review Session Flow
```
1. User completes review item
2. Review Engine calculates next review time (SRS)
3. Review Engine emits ITEM_ANSWERED event
4. NotificationOrchestrator receives event
5. Orchestrator checks user preferences
6. If immediate review (<1hr):
   - Schedule browser notification
   - Add in-app countdown
   - Queue push notification
7. If daily review (>1hr):
   - Add to daily batch
8. When review time arrives:
   - Fire all enabled channels
   - Track notification sent
   - Monitor user response
```

### Preference Sync Flow
```
1. User updates preferences in Settings
2. Save to Firestore
3. Orchestrator reloads preferences
4. Update active timers/schedules
5. Cancel/reschedule as needed
```

### Offline Support Flow
```
1. Service Worker caches notification data
2. Store scheduled notifications in IndexedDB
3. On reconnect:
   - Sync with server
   - Show missed notifications
   - Update schedules
```

---

## Testing Strategy

### Unit Tests
- Each service class has dedicated test file
- Mock external dependencies
- Test edge cases and error handling
- Coverage target: >80%

### Integration Tests
- Test communication between services
- Verify Review Engine integration
- Test preference application
- Test notification delivery

### E2E Tests
- Full user flows
- Permission flows
- Notification delivery
- Cross-browser testing

### Performance Tests
- Notification latency (<100ms)
- Battery impact monitoring
- Memory usage profiling
- Network efficiency

---

## Deployment Checklist

### Day 1
- [ ] All agents complete initial implementation
- [ ] Unit tests passing
- [ ] Basic integration working

### Day 2
- [ ] Services integrated
- [ ] E2E tests passing
- [ ] Performance validated
- [ ] Documentation complete

### Day 3
- [ ] Production deployment
- [ ] Monitoring enabled
- [ ] A/B test configured
- [ ] Rollback plan ready

---

## Monitoring & Analytics

### Key Metrics
1. **Engagement**
   - Notification click-through rate
   - Time to action after notification
   - Channel preference distribution

2. **Performance**
   - Notification delivery latency
   - Service worker registration success
   - FCM token generation success

3. **User Behavior**
   - Preference changes over time
   - Quiet hours usage
   - Notification dismissal rate

### Error Tracking
```typescript
interface NotificationError {
  userId: string
  errorType: 'permission' | 'delivery' | 'scheduling' | 'unknown'
  channel: 'browser' | 'push' | 'inApp'
  message: string
  stack?: string
  timestamp: Date
}
```

---

## Security Considerations

1. **Token Security**
   - FCM tokens encrypted in transit
   - Tokens rotated periodically
   - Server-side validation

2. **Permission Management**
   - Explicit user consent required
   - Granular permission controls
   - Easy revocation

3. **Data Privacy**
   - Minimal PII in notifications
   - User preferences encrypted
   - GDPR compliant

---

## Future Enhancements

1. **Smart Scheduling**
   - ML-based optimal timing
   - User activity pattern learning
   - Adaptive batching

2. **Rich Notifications**
   - Progress bars in notification
   - Quick actions for review
   - Preview of review content

3. **Cross-Device Sync**
   - Sync notification state
   - Dismiss on one device dismisses all
   - Unified preference management

---

## Conclusion

This MVP specification provides a complete implementation plan for the Moshimoshi notification system. With 4 agents working in parallel over 3 days, the system can be fully implemented, tested, and deployed. The architecture is scalable, maintainable, and provides an excellent user experience for timely review reminders.

**Total Implementation Time**: 3 days (4 agents parallel)
**Lines of Code**: ~4,500
**Test Coverage**: >80%
**Expected CTR Improvement**: 200-300%