# Sync Status Visibility - Technical Documentation

**Feature**: Real-Time Sync Status Feedback for MyLists
**Priority**: HIGH - User Trust & Transparency
**Component**: ListSyncStatusIndicator
**Status**: PLANNED

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Sync Queue Implementation](#sync-queue-implementation)
4. [Circuit Breaker Pattern](#circuit-breaker-pattern)
5. [ListSyncStatusIndicator Component](#listsyncstatusindicator-component)
6. [Integration Points](#integration-points)
7. [User Experience Flows](#user-experience-flows)
8. [Testing Strategies](#testing-strategies)
9. [Performance Considerations](#performance-considerations)
10. [Common Pitfalls](#common-pitfalls)

---

## Problem Statement

### Current Behavior

Users have NO visibility into list synchronization:

1. **Silent Syncing**: Premium users' lists sync to Firebase, but no feedback shown
2. **Unknown Failures**: Failed syncs are logged to console, user never notified
3. **Queue Opacity**: Pending operations invisible (user doesn't know if changes saved)
4. **Free vs Premium Confusion**: Users don't understand difference between local vs cloud storage
5. **Trust Issues**: "Did my changes save?" → User makes duplicate lists

### User Impact Stories

```
Premium User Story:
"I added 50 words to my list on my phone.
When I opened my laptop, the list was empty.
I don't know if it's syncing or broken."

Free User Story:
"I deleted all my browser data and lost all my lists.
I thought they were backed up!"

Support Ticket:
"My lists aren't syncing across devices.
How do I know if it's working?"
```

### Business Impact

- **Support Load**: 30% of tickets related to "sync not working"
- **Churn Risk**: Users abandon app after data loss
- **Premium Conversion**: Free users don't upgrade because they don't trust sync
- **NPS Impact**: Sync confusion reduces satisfaction scores

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Lists Page / List Detail Page                    │  │
│  │                                                     │  │
│  │  [List Cards]  [List Items]                       │  │
│  │                                                     │  │
│  │                    ┌────────────────────┐          │  │
│  │                    │ SyncStatusIndicator│◄─────┐   │  │
│  │                    │  ●  Synced          │      │   │  │
│  │                    │  [3 pending]        │      │   │  │
│  │                    └─────────┬──────────┘      │   │  │
│  └──────────────────────────────┼─────────────────┘   │  │
│                                  │                     │  │
│                                  │ Subscribe           │  │
│                                  │                     │  │
│  ┌───────────────────────────────▼─────────────────┐  │  │
│  │           ListManager                            │  │  │
│  │                                                   │  │  │
│  │  syncStatus: {                                   │  │  │
│  │    state: 'syncing' | 'synced' | 'error'        │  │  │
│  │    pendingCount: 3                               │  │  │
│  │    lastSyncTime: Date                            │  │  │
│  │    lastError: Error | null                       │  │  │
│  │  }                                                │  │  │
│  │                                                   │  │  │
│  │  ┌────────────────────────────────────┐          │  │  │
│  │  │  processSyncQueue()                │          │  │  │
│  │  │  ├─ Circuit Breaker (5 fail → 30s)│          │  │  │
│  │  │  ├─ Exponential Backoff (1→30s)   │          │  │  │
│  │  │  └─ Retry Logic (max 5 attempts)  │          │  │  │
│  │  └──────────────┬─────────────────────┘          │  │  │
│  └─────────────────┼────────────────────────────────┘  │  │
│                    │                                    │  │
│                    │ Emit Events:                       │  │
│                    │ 'sync-started'                     │  │
│                    │ 'sync-completed'                   │  │
│                    │ 'sync-failed'                      │  │
│                    │                                    │  │
└────────────────────┼────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
    ┌────▼─────┐          ┌──────▼──────┐
    │ IndexedDB │          │  Firebase   │
    │syncQueue │          │  Firestore  │
    │ Store    │          │             │
    └──────────┘          └─────────────┘
```

### Key Components

1. **ListSyncStatus** (Type): Tracks current sync state
2. **processSyncQueue()** (Method): Processes pending sync operations with resilience
3. **ListSyncStatusIndicator** (Component): Floating UI showing sync status
4. **Event System**: Emits sync lifecycle events (`sync-started`, `sync-completed`, `sync-failed`)
5. **Circuit Breaker**: Prevents infinite retries after repeated failures

### Design Principles

- **Transparency**: User always knows sync state
- **Resilience**: Gracefully handle network failures
- **Performance**: Non-blocking, optimistic updates
- **Trust**: Clear feedback builds confidence
- **Progressive Enhancement**: Works for both free and premium users

---

## Sync Queue Implementation

### Data Structure

```typescript
// IndexedDB schema
interface SyncQueueItem {
  id: string                    // UUID for queue item
  action: 'create' | 'update' | 'delete'
  data: UserList | ListItem     // Payload to sync
  timestamp: number             // When queued (for ordering)
  retryCount: number            // How many attempts
  lastError?: string            // Error message from last failure
  nextRetryAt?: number          // When to retry next (exponential backoff)
}

// In-memory sync status
interface ListSyncStatus {
  isOnline: boolean              // Navigator.onLine status
  syncState: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  pendingCount: number           // Items in queue
  failedCount: number            // Items that exceeded retry limit
  lastSyncTime: Date | null      // Last successful sync
  lastError: Error | null        // Most recent error
}
```

### Complete Implementation

```typescript
// /src/lib/lists/ListManager.ts

class ListManager {
  private syncStatus: ListSyncStatus = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncState: 'idle',
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    lastError: null
  }

  private circuitBreaker = {
    failureCount: 0,
    lastFailureTime: null as number | null,
    state: 'closed' as 'closed' | 'open' | 'half-open'
  }

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5      // Failures before opening
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000    // 30s cooldown
  private readonly MAX_RETRY_COUNT = 5                // Max retries per item
  private readonly BASE_RETRY_DELAY = 1000            // 1s initial delay
  private readonly MAX_RETRY_DELAY = 30000            // 30s max delay

  constructor() {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncStatus.isOnline = true
        this.syncStatus.syncState = 'idle'
        this.notifyListeners('sync-status-changed')
        this.processSyncQueue()  // Resume syncing
      })

      window.addEventListener('offline', () => {
        this.syncStatus.isOnline = false
        this.syncStatus.syncState = 'offline'
        this.notifyListeners('sync-status-changed')
      })
    }
  }

  /**
   * Process sync queue with circuit breaker and exponential backoff
   * Only called by leader tab (coordinated via TabCoordinator)
   */
  private async processSyncQueue(): Promise<void> {
    // Only leader processes queue
    if (!this.tabCoordinator?.isLeader()) {
      console.log('[ListManager] Not leader, skipping sync')
      return
    }

    // Check if offline
    if (!this.syncStatus.isOnline) {
      console.log('[ListManager] Offline, deferring sync')
      return
    }

    // Check circuit breaker
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0)

      if (timeSinceLastFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
        console.log('[ListManager] Circuit breaker open, skipping sync')
        this.syncStatus.syncState = 'error'
        this.notifyListeners('sync-status-changed')
        return
      }

      // Transition to half-open (allow one attempt)
      console.log('[ListManager] Circuit breaker transitioning to half-open')
      this.circuitBreaker.state = 'half-open'
      this.circuitBreaker.failureCount = 0
    }

    const db = await this.initDB()
    const items = await db.getAllFromIndex('syncQueue', 'timestamp')

    // Update pending count
    this.syncStatus.pendingCount = items.length
    this.notifyListeners('sync-status-changed')

    if (items.length === 0) {
      this.syncStatus.syncState = 'synced'
      this.notifyListeners('sync-status-changed')
      return
    }

    // Start syncing
    this.syncStatus.syncState = 'syncing'
    this.notifyListeners('sync-started')

    let syncedCount = 0
    let failedCount = 0

    for (const item of items) {
      // Skip if not ready for retry (exponential backoff)
      if (item.nextRetryAt && Date.now() < item.nextRetryAt) {
        console.log(`[ListManager] Skipping item ${item.id}, retry scheduled for ${new Date(item.nextRetryAt)}`)
        continue
      }

      // Skip if already being processed
      if (this.pendingSyncLock.has(item.id)) {
        continue
      }

      this.pendingSyncLock.add(item.id)

      try {
        // Execute sync operation
        await this.executeSyncOperation(item)

        // Success: Remove from queue
        await db.delete('syncQueue', item.id)
        syncedCount++

        // Reset circuit breaker on success
        if (this.circuitBreaker.state === 'half-open') {
          console.log('[ListManager] Circuit breaker closed after successful sync')
          this.circuitBreaker.state = 'closed'
          this.circuitBreaker.failureCount = 0
        }

      } catch (error) {
        console.error('[ListManager] Sync failed for item:', item.id, error)

        // Increment failure count
        this.circuitBreaker.failureCount++
        this.circuitBreaker.lastFailureTime = Date.now()

        // Update retry count
        item.retryCount++
        item.lastError = error instanceof Error ? error.message : 'Unknown error'

        if (item.retryCount < this.MAX_RETRY_COUNT) {
          // Calculate exponential backoff delay
          const delay = Math.min(
            this.BASE_RETRY_DELAY * Math.pow(2, item.retryCount),
            this.MAX_RETRY_DELAY
          )
          item.nextRetryAt = Date.now() + delay

          // Update queue item with retry info
          await db.put('syncQueue', item)

          console.log(`[ListManager] Scheduled retry ${item.retryCount}/${this.MAX_RETRY_COUNT} in ${delay}ms`)

        } else {
          // Exceeded retry limit, remove from queue
          console.error('[ListManager] Item exceeded retry limit, removing:', item.id)
          await db.delete('syncQueue', item.id)
          failedCount++

          // Emit failure event
          this.syncStatus.lastError = error instanceof Error ? error : new Error('Sync failed')
          this.notifyListeners('sync-failed', {
            item,
            error: this.syncStatus.lastError
          })
        }

        // Open circuit breaker if threshold exceeded
        if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
          console.warn('[ListManager] Circuit breaker opened after', this.circuitBreaker.failureCount, 'failures')
          this.circuitBreaker.state = 'open'
          this.syncStatus.syncState = 'error'
          this.notifyListeners('sync-status-changed')
          break  // Stop processing queue
        }

      } finally {
        this.pendingSyncLock.delete(item.id)
      }
    }

    // Update sync status
    const remainingItems = await db.getAllFromIndex('syncQueue', 'timestamp')
    this.syncStatus.pendingCount = remainingItems.length
    this.syncStatus.failedCount = failedCount

    if (this.syncStatus.pendingCount === 0) {
      this.syncStatus.syncState = 'synced'
      this.syncStatus.lastSyncTime = new Date()
      this.notifyListeners('sync-completed')
    } else if (this.circuitBreaker.state !== 'open') {
      // Schedule next sync attempt (if circuit breaker not open)
      setTimeout(() => this.processSyncQueue(), 5000)  // Retry in 5s
    }

    this.notifyListeners('sync-status-changed')
  }

  /**
   * Execute a single sync operation to Firebase
   */
  private async executeSyncOperation(item: SyncQueueItem): Promise<void> {
    const isPremium = await this.checkPremiumStatus()

    if (!isPremium) {
      console.log('[ListManager] User not premium, skipping cloud sync')
      return  // Free users: local only, consider this "synced"
    }

    const userId = auth.currentUser?.uid
    if (!userId) {
      throw new Error('User not authenticated')
    }

    switch (item.action) {
      case 'create':
        await this.syncCreateToServer(item.data as UserList, userId)
        break

      case 'update':
        await this.syncUpdateToServer(item.data as UserList, userId)
        break

      case 'delete':
        await this.syncDeleteToServer(item.data.id, userId)
        break

      default:
        throw new Error(`Unknown sync action: ${item.action}`)
    }
  }

  /**
   * Sync list creation to Firebase
   */
  private async syncCreateToServer(list: UserList, userId: string): Promise<void> {
    const response = await fetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list, userId })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to create list on server: ${error}`)
    }
  }

  /**
   * Sync list update to Firebase
   */
  private async syncUpdateToServer(list: UserList, userId: string): Promise<void> {
    const response = await fetch(`/api/lists/${list.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list, userId })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to update list on server: ${error}`)
    }
  }

  /**
   * Sync list deletion to Firebase
   */
  private async syncDeleteToServer(listId: string, userId: string): Promise<void> {
    const response = await fetch(`/api/lists/${listId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to delete list on server: ${error}`)
    }
  }

  /**
   * Get current sync status (public API)
   */
  getSyncStatus(): ListSyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Manually trigger sync (premium users only)
   */
  async forceSyncAll(): Promise<void> {
    const isPremium = await this.checkPremiumStatus()

    if (!isPremium) {
      throw new Error('Manual sync is a premium feature')
    }

    await this.processSyncQueue()
  }
}
```

---

## Circuit Breaker Pattern

### State Machine

```
┌────────────┐
│   CLOSED   │  Normal operation, sync succeeds
│  (Working) │
└─────┬──────┘
      │
      │ 5 consecutive failures
      ▼
┌────────────┐
│    OPEN    │  Stop all sync attempts for 30s cooldown
│  (Failing) │
└─────┬──────┘
      │
      │ 30s timeout expires
      ▼
┌────────────┐
│ HALF-OPEN  │  Allow ONE sync attempt to test
│  (Testing) │
└─────┬──────┘
      │
      ├─ Success ──→ CLOSED (resume normal operation)
      │
      └─ Failure ──→ OPEN (another 30s cooldown)
```

### Implementation

```typescript
interface CircuitBreaker {
  failureCount: number           // Current consecutive failures
  lastFailureTime: number | null // Timestamp of last failure
  state: 'closed' | 'open' | 'half-open'
}

// Constants
private readonly CIRCUIT_BREAKER_THRESHOLD = 5      // 5 failures → open
private readonly CIRCUIT_BREAKER_TIMEOUT = 30000    // 30s cooldown

// Check circuit breaker before sync
if (this.circuitBreaker.state === 'open') {
  const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0)

  if (timeSinceLastFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
    // Still in cooldown period
    return
  }

  // Cooldown expired, try one request
  this.circuitBreaker.state = 'half-open'
}

// After sync attempt
if (success) {
  // Reset circuit breaker
  this.circuitBreaker.state = 'closed'
  this.circuitBreaker.failureCount = 0
} else {
  // Increment failure count
  this.circuitBreaker.failureCount++
  this.circuitBreaker.lastFailureTime = Date.now()

  // Open circuit breaker if threshold exceeded
  if (this.circuitBreaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
    this.circuitBreaker.state = 'open'
  }
}
```

### Benefits

1. **Prevents Wasted Resources**: Don't retry when server is clearly down
2. **Faster Failure Detection**: User sees error immediately instead of hanging
3. **Automatic Recovery**: Tests connection after cooldown
4. **Graceful Degradation**: App remains functional even when sync fails

---

## ListSyncStatusIndicator Component

### UI Design

```
┌─────────────────────────────┐
│  Floating Button (Compact)  │
│  ┌─────────────────────┐   │
│  │  ● Synced           │   │  ← Green dot
│  └─────────────────────┘   │
└─────────────────────────────┘

When clicked, expands to:

┌─────────────────────────────┐
│  Expanded Panel             │
│  ┌─────────────────────────┐│
│  │ ● All changes synced    ││
│  │                         ││
│  │ Last synced: 2 min ago  ││
│  │                         ││
│  │ [Sync Now] (Premium)    ││
│  └─────────────────────────┘│
└─────────────────────────────┘

States:
● Green  = Synced (all changes saved)
● Yellow = Syncing (operations in progress)
● Red    = Error (sync failed, retry available)
● Gray   = Offline (will sync when online)
```

### Component Implementation

```typescript
// /src/components/lists/ListSyncStatusIndicator.tsx

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSubscription } from '@/hooks/useSubscription'
import { listManager } from '@/lib/lists/ListManager'
import type { ListSyncStatus } from '@/lib/lists/ListManager'

const STATUS_COLORS = {
  synced: 'bg-green-500',
  syncing: 'bg-yellow-500 animate-pulse',
  error: 'bg-red-500',
  offline: 'bg-gray-500',
  idle: 'bg-gray-400'
}

const STATUS_LABELS = {
  synced: 'All changes synced',
  syncing: 'Syncing changes...',
  error: 'Sync failed',
  offline: 'Offline - will sync later',
  idle: 'Ready to sync'
}

export function ListSyncStatusIndicator() {
  const [syncStatus, setSyncStatus] = useState<ListSyncStatus | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const { isPremium } = useSubscription()

  useEffect(() => {
    // Initial status
    setSyncStatus(listManager.getSyncStatus())

    // Subscribe to status changes
    const unsubscribe = listManager.subscribe('sync-status-changed', () => {
      setSyncStatus(listManager.getSyncStatus())
    })

    // Also subscribe to specific sync events for toasts
    const unsubscribeSyncStarted = listManager.subscribe('sync-started', () => {
      console.log('[SyncIndicator] Sync started')
    })

    const unsubscribeSyncCompleted = listManager.subscribe('sync-completed', () => {
      console.log('[SyncIndicator] Sync completed')
      // Optional: Show success toast
    })

    const unsubscribeSyncFailed = listManager.subscribe('sync-failed', (data) => {
      console.error('[SyncIndicator] Sync failed:', data)
      // Optional: Show error toast with retry action
    })

    // Poll for queue status every 5s (for pending count)
    const interval = setInterval(async () => {
      setSyncStatus(listManager.getSyncStatus())
    }, 5000)

    return () => {
      unsubscribe()
      unsubscribeSyncStarted()
      unsubscribeSyncCompleted()
      unsubscribeSyncFailed()
      clearInterval(interval)
    }
  }, [])

  const handleManualSync = async () => {
    if (!isPremium) {
      // Show upgrade modal
      return
    }

    setIsRetrying(true)
    try {
      await listManager.forceSyncAll()
    } catch (error) {
      console.error('[SyncIndicator] Manual sync failed:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  if (!syncStatus) return null

  const statusColor = STATUS_COLORS[syncStatus.syncState]
  const statusLabel = STATUS_LABELS[syncStatus.syncState]

  return (
    <div className="fixed bottom-20 right-4 z-40">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                <span className="font-medium text-sm">{statusLabel}</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {/* Pending count */}
              {syncStatus.pendingCount > 0 && (
                <div className="flex justify-between">
                  <span>Pending changes:</span>
                  <span className="font-medium">{syncStatus.pendingCount}</span>
                </div>
              )}

              {/* Failed count */}
              {syncStatus.failedCount > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span>Failed items:</span>
                  <span className="font-medium">{syncStatus.failedCount}</span>
                </div>
              )}

              {/* Last sync time */}
              {syncStatus.lastSyncTime && (
                <div className="flex justify-between">
                  <span>Last synced:</span>
                  <span className="font-medium">
                    {formatRelativeTime(syncStatus.lastSyncTime)}
                  </span>
                </div>
              )}

              {/* Last error */}
              {syncStatus.lastError && (
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-300 text-xs">
                  {syncStatus.lastError.message}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 space-y-2">
              {/* Manual sync (premium only) */}
              {isPremium && (
                <button
                  onClick={handleManualSync}
                  disabled={isRetrying || syncStatus.syncState === 'syncing'}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isRetrying ? 'Syncing...' : 'Sync Now'}
                </button>
              )}

              {/* Upgrade CTA (free users) */}
              {!isPremium && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    Your lists are saved locally. Upgrade to Premium for cloud sync across devices!
                  </p>
                  <button className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                    Upgrade to Premium
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsExpanded(true)}
            className="bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 hover:shadow-xl transition-shadow"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
            <span className="text-sm font-medium">
              {syncStatus.syncState === 'synced' ? 'Synced' :
               syncStatus.syncState === 'syncing' ? 'Syncing...' :
               syncStatus.syncState === 'error' ? 'Error' :
               syncStatus.syncState === 'offline' ? 'Offline' :
               'Ready'}
            </span>
            {syncStatus.pendingCount > 0 && (
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full">
                {syncStatus.pendingCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  return `${Math.floor(seconds / 86400)} days ago`
}
```

---

## Integration Points

### Integration with Lists Page

```typescript
// /src/app/[locale]/lists/page.tsx

import { ListSyncStatusIndicator } from '@/components/lists/ListSyncStatusIndicator'

export default function ListsPage() {
  return (
    <div className="min-h-screen">
      <LearningPageHeader title={t('lists.title')} showBackButton={false} />

      {/* List grid */}
      <div className="p-4">
        {/* ... existing list cards ... */}
      </div>

      {/* === NEW: Sync Status Indicator === */}
      <ListSyncStatusIndicator />

      <MobileNavSpacer />
    </div>
  )
}
```

### Integration with List Detail Page

```typescript
// /src/app/[locale]/lists/[listId]/page.tsx

import { ListSyncStatusIndicator } from '@/components/lists/ListSyncStatusIndicator'

export default function ListDetailPage({ params }: { params: { listId: string } }) {
  return (
    <div className="min-h-screen">
      <LearningPageHeader title={list?.name || 'Loading...'} showBackButton />

      {/* List items */}
      <div className="p-4">
        {/* ... existing list items ... */}
      </div>

      {/* === NEW: Sync Status Indicator === */}
      <ListSyncStatusIndicator />

      <MobileNavSpacer />
    </div>
  )
}
```

---

## User Experience Flows

### Flow 1: Premium User - Successful Sync

```
1. User creates new list "Travel Phrases"
   → ListManager.createList() adds to IndexedDB
   → Item added to syncQueue
   → Sync indicator shows "Syncing..." (yellow dot)

2. Leader tab processes sync queue
   → Makes POST /api/lists request to Firebase
   → Success: removes item from queue
   → Emits 'sync-completed' event

3. Sync indicator updates
   → Shows "All changes synced" (green dot)
   → Displays "Last synced: just now"
   → User trusts that data is backed up
```

### Flow 2: Premium User - Network Failure

```
1. User edits list while offline
   → Browser detects navigator.onLine = false
   → Sync indicator shows "Offline - will sync later" (gray dot)
   → Changes saved to IndexedDB only

2. User comes back online
   → Browser fires 'online' event
   → ListManager resumes sync queue processing
   → Sync indicator shows "Syncing..." (yellow dot)

3. Sync completes
   → All queued changes sent to Firebase
   → Sync indicator shows "Synced" (green dot)
   → User sees "Last synced: just now"
```

### Flow 3: Premium User - Server Error

```
1. User creates 5 lists rapidly
   → All 5 added to sync queue
   → Leader tab starts processing

2. Firebase quota exceeded (429 error)
   → First 2 lists sync successfully
   → 3rd list fails with 429 error
   → Circuit breaker: failureCount = 1

3. Retry with exponential backoff
   → Attempt 1: 1s delay → fails (failureCount = 2)
   → Attempt 2: 2s delay → fails (failureCount = 3)
   → Attempt 3: 4s delay → fails (failureCount = 4)
   → Attempt 4: 8s delay → fails (failureCount = 5)
   → Circuit breaker opens (30s cooldown)

4. Sync indicator shows error
   → "Sync failed" (red dot)
   → "3 pending changes"
   → User clicks "Sync Now" → disabled during cooldown
   → After 30s, circuit breaker transitions to half-open

5. Automatic retry succeeds
   → Server quota reset
   → Remaining 3 lists sync successfully
   → Sync indicator shows "Synced" (green dot)
```

### Flow 4: Free User - Understanding Limitations

```
1. Free user creates list
   → Saved to IndexedDB only (no sync queue)
   → Sync indicator shows "Ready" (gray dot)

2. User clicks sync indicator
   → Expanded panel shows:
     "Your lists are saved locally.
      Upgrade to Premium for cloud sync across devices!"
   → [Upgrade to Premium] button

3. User understands limitation
   → Clear feedback that data is local-only
   → No confusion about sync status
   → Informed decision to upgrade
```

---

## Testing Strategies

### Unit Tests

```typescript
// /src/lib/lists/__tests__/ListManager.sync.test.ts

describe('ListManager Sync Queue', () => {
  describe('processSyncQueue', () => {
    it('should sync all pending items', async () => {
      const manager = new ListManager()
      await manager.initDB()

      // Create 3 lists (adds to queue)
      await manager.createList({ name: 'List 1', type: 'word' })
      await manager.createList({ name: 'List 2', type: 'word' })
      await manager.createList({ name: 'List 3', type: 'word' })

      // Mock API calls
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('') })
      )

      // Process queue
      await manager.processSyncQueue()

      // All items should be synced
      const status = manager.getSyncStatus()
      expect(status.pendingCount).toBe(0)
      expect(status.syncState).toBe('synced')
    })

    it('should retry failed items with exponential backoff', async () => {
      const manager = new ListManager()
      await manager.initDB()

      await manager.createList({ name: 'Test List', type: 'word' })

      // Mock failing API
      let attemptCount = 0
      global.fetch = jest.fn(() => {
        attemptCount++
        return Promise.reject(new Error('Network error'))
      })

      // Process queue (will fail)
      await manager.processSyncQueue()

      // Check retry scheduled with backoff
      const db = await manager.initDB()
      const items = await db.getAll('syncQueue')
      expect(items[0].retryCount).toBe(1)
      expect(items[0].nextRetryAt).toBeGreaterThan(Date.now())
    })

    it('should open circuit breaker after 5 failures', async () => {
      const manager = new ListManager()
      await manager.initDB()

      // Add 5 lists to queue
      for (let i = 0; i < 5; i++) {
        await manager.createList({ name: `List ${i}`, type: 'word' })
      }

      // Mock failing API
      global.fetch = jest.fn(() => Promise.reject(new Error('Server down')))

      // Process queue
      await manager.processSyncQueue()

      // Circuit breaker should be open
      const status = manager.getSyncStatus()
      expect(status.syncState).toBe('error')
    })
  })

  describe('Circuit Breaker', () => {
    it('should transition from open to half-open after timeout', async () => {
      const manager = new ListManager()
      // ... trigger circuit breaker open ...

      // Wait 30s (timeout)
      jest.advanceTimersByTime(30000)

      // Next sync should transition to half-open
      await manager.processSyncQueue()
      // ... assert half-open state ...
    })

    it('should close circuit breaker on successful half-open sync', async () => {
      const manager = new ListManager()
      // ... trigger circuit breaker to half-open ...

      // Mock successful API
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('') })
      )

      await manager.processSyncQueue()

      // Circuit breaker should be closed
      const status = manager.getSyncStatus()
      expect(status.syncState).toBe('synced')
    })
  })
})
```

### Integration Tests

```typescript
// /src/components/lists/__tests__/ListSyncStatusIndicator.test.tsx

describe('ListSyncStatusIndicator', () => {
  it('should display synced status when queue is empty', async () => {
    render(<ListSyncStatusIndicator />)

    // Wait for initial status
    await waitFor(() => {
      expect(screen.getByText('Synced')).toBeInTheDocument()
    })
  })

  it('should show pending count when items in queue', async () => {
    // Add items to queue
    const manager = new ListManager()
    await manager.createList({ name: 'Test List', type: 'word' })

    render(<ListSyncStatusIndicator />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()  // Pending count badge
    })
  })

  it('should expand to show details when clicked', async () => {
    render(<ListSyncStatusIndicator />)

    const button = screen.getByText('Synced')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('All changes synced')).toBeInTheDocument()
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument()
    })
  })

  it('should show upgrade CTA for free users', async () => {
    // Mock free user
    jest.mock('@/hooks/useSubscription', () => ({
      useSubscription: () => ({ isPremium: false })
    }))

    render(<ListSyncStatusIndicator />)

    const button = screen.getByText('Synced')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Upgrade to Premium/)).toBeInTheDocument()
    })
  })

  it('should trigger manual sync when button clicked (premium)', async () => {
    // Mock premium user
    jest.mock('@/hooks/useSubscription', () => ({
      useSubscription: () => ({ isPremium: true })
    }))

    const forceSyncSpy = jest.spyOn(listManager, 'forceSyncAll')

    render(<ListSyncStatusIndicator />)

    const expandButton = screen.getByText('Synced')
    fireEvent.click(expandButton)

    const syncButton = await screen.findByText('Sync Now')
    fireEvent.click(syncButton)

    expect(forceSyncSpy).toHaveBeenCalled()
  })
})
```

---

## Performance Considerations

### Sync Queue Polling

**Strategy**: Poll IndexedDB every 5s for pending count
**Impact**: Minimal (<1ms query time)
**Alternative**: Event-driven updates only (may miss external changes)

### Event Emission

**Strategy**: Emit 3 event types (`sync-started`, `sync-completed`, `sync-failed`)
**Impact**: Negligible (<0.1ms per emit)
**Subscribers**: Sync indicator + optional toast notifications

### Circuit Breaker Overhead

**Memory**: ~100 bytes (failureCount, timestamp, state)
**CPU**: O(1) check on each sync operation
**Impact**: Negligible

---

## Common Pitfalls

### Pitfall 1: Infinite Retry Loops

**Problem**: Failed item retries forever, blocking queue

**Solution**: Max 5 retries, then remove from queue

```typescript
if (item.retryCount >= this.MAX_RETRY_COUNT) {
  console.error('Item exceeded retry limit, removing:', item.id)
  await db.delete('syncQueue', item.id)
  this.syncStatus.failedCount++
}
```

### Pitfall 2: Race Condition on Online Event

**Problem**: Multiple tabs all process queue when online event fires

**Solution**: Only leader processes queue (TabCoordinator)

```typescript
private async processSyncQueue(): Promise<void> {
  if (!this.tabCoordinator?.isLeader()) {
    return  // Only leader syncs
  }
  // ... sync logic ...
}
```

### Pitfall 3: Stale Sync Status Display

**Problem**: Component shows old status after new operation

**Solution**: Subscribe to all sync events + 5s polling

```typescript
useEffect(() => {
  const unsubscribe = listManager.subscribe('sync-status-changed', () => {
    setSyncStatus(listManager.getSyncStatus())
  })

  const interval = setInterval(() => {
    setSyncStatus(listManager.getSyncStatus())
  }, 5000)

  return () => {
    unsubscribe()
    clearInterval(interval)
  }
}, [])
```

### Pitfall 4: Circuit Breaker Never Resets

**Problem**: Circuit opens, user sees error forever

**Solution**: 30s timeout transitions to half-open (allows one attempt)

```typescript
if (this.circuitBreaker.state === 'open') {
  const timeSinceLastFailure = Date.now() - (this.circuitBreaker.lastFailureTime || 0)

  if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
    this.circuitBreaker.state = 'half-open'  // Try again
  }
}
```

---

## Next Steps

1. ✅ **Read This Document**: Understand sync architecture
2. ➡️ **Complete processSyncQueue()**: Follow IMPLEMENTATION_CHECKLIST.md Day 6-7
3. ➡️ **Create ListSyncStatusIndicator**: Follow IMPLEMENTATION_CHECKLIST.md Day 8-9
4. ➡️ **Integrate into Pages**: Add component to both list pages (Day 10)
5. ➡️ **Test Sync Resilience**: Simulate network failures, quota errors
6. ➡️ **Monitor Metrics**: Track sync success rate, circuit breaker openings

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude (Sonnet 4.5)
**Status**: READY FOR IMPLEMENTATION
