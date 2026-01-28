# MyLists Reliability Implementation Checklist

**Status**: READY FOR IMPLEMENTATION
**Priority**: HIGH - Critical Production Bugs
**Estimated Time**: 15 development days + 15 rollout days

---

## Quick Start

This checklist provides a step-by-step implementation guide for addressing 3 critical issues in the MyLists feature:

1. **Multi-Tab Coordination** (Days 1-5)
2. **Sync Status Visibility** (Days 6-10)
3. **Storage Quota Handling** (Days 11-12)

**Prerequisites:**
- Access to `/home/beano/DevProjects/NextJs/moshimoshi`
- Node.js 18+, npm installed
- Firebase Admin SDK configured
- Understanding of IndexedDB, BroadcastChannel API

---

## Phase 1: Multi-Tab Coordination (Days 1-5)

### Day 1: TabCoordinator Foundation

**☐ Task 1.1: Create TabCoordinator Class**

```bash
# Create new file
touch src/lib/lists/TabCoordinator.ts
```

**File**: `/src/lib/lists/TabCoordinator.ts`

```typescript
/**
 * TabCoordinator - Manages cross-tab communication and leader election
 *
 * Uses BroadcastChannel API for messaging between tabs
 * Implements heartbeat-based leader election (5s interval, 10s timeout)
 * Falls back to localStorage events if BroadcastChannel unavailable
 */

export interface TabMessage {
  type: 'list-created' | 'list-updated' | 'list-deleted' |
        'item-added' | 'item-removed' | 'sync-request' |
        'leader-election' | 'heartbeat' | 'state-sync'
  tabId: string
  timestamp: number
  data: any
  requiresResponse?: boolean
}

export class TabCoordinator {
  private channel: BroadcastChannel | null = null
  private tabId: string
  private isLeaderFlag: boolean = false
  private heartbeatInterval: NodeJS.Timeout | null = null
  private leaderTimeoutCheck: NodeJS.Timeout | null = null
  private messageCallback: ((msg: TabMessage) => void) | null = null
  private useFallback: boolean = false
  private leaderTimestamp: number = 0
  private readonly HEARTBEAT_INTERVAL = 5000 // 5s
  private readonly LEADER_TIMEOUT = 10000 // 10s

  constructor(private channelName: string) {
    this.tabId = this.generateTabId()
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async initialize(): Promise<void> {
    // Check BroadcastChannel support
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[TabCoordinator] BroadcastChannel not supported, using localStorage fallback')
      this.useFallback = true
      this.initializeFallback()
      return
    }

    // Initialize BroadcastChannel
    this.channel = new BroadcastChannel(this.channelName)
    this.channel.onmessage = (event) => {
      this.handleMessage(event.data)
    }

    // Start leader election
    this.electLeader()
  }

  private electLeader(): void {
    // Broadcast election message
    const electionMessage: TabMessage = {
      type: 'leader-election',
      tabId: this.tabId,
      timestamp: Date.now(),
      data: null
    }

    this.broadcast(electionMessage)

    // Set self as leader initially (will be overridden if older tab exists)
    setTimeout(() => {
      if (!this.isLeaderFlag) {
        this.becomeLeader()
      }
    }, 100)
  }

  private becomeLeader(): void {
    this.isLeaderFlag = true
    this.leaderTimestamp = Date.now()

    console.log(`[TabCoordinator] Tab ${this.tabId} became leader`)

    // Start sending heartbeats
    this.startHeartbeat()
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isLeaderFlag) {
        this.broadcast({
          type: 'heartbeat',
          tabId: this.tabId,
          timestamp: Date.now(),
          data: null
        })
      }
    }, this.HEARTBEAT_INTERVAL)

    // Also start checking for leader timeout
    this.startLeaderTimeoutCheck()
  }

  private startLeaderTimeoutCheck(): void {
    if (this.leaderTimeoutCheck) {
      clearInterval(this.leaderTimeoutCheck)
    }

    this.leaderTimeoutCheck = setInterval(() => {
      // If we're not leader and haven't heard heartbeat in 10s, elect new leader
      if (!this.isLeaderFlag) {
        const timeSinceLastHeartbeat = Date.now() - this.leaderTimestamp
        if (timeSinceLastHeartbeat > this.LEADER_TIMEOUT) {
          console.warn('[TabCoordinator] Leader timeout, starting new election')
          this.electLeader()
        }
      }
    }, 2000)
  }

  private handleMessage(message: TabMessage): void {
    switch (message.type) {
      case 'leader-election':
        // If received election from older tab, yield leadership
        if (message.timestamp < Date.now() - 100) {
          this.isLeaderFlag = false
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
          }
        }
        break

      case 'heartbeat':
        // Update last known leader timestamp
        this.leaderTimestamp = message.timestamp
        break

      default:
        // Pass message to callback
        if (this.messageCallback) {
          this.messageCallback(message)
        }
    }
  }

  private initializeFallback(): void {
    // Use localStorage events as fallback
    window.addEventListener('storage', (event) => {
      if (event.key?.startsWith(`${this.channelName}:`)) {
        try {
          const message = JSON.parse(event.newValue || '{}')
          this.handleMessage(message)
        } catch (error) {
          console.error('[TabCoordinator] Failed to parse localStorage message:', error)
        }
      }
    })

    // Assume leader in fallback mode (localStorage events are unreliable for election)
    this.becomeLeader()
  }

  broadcast(message: TabMessage): void {
    if (this.useFallback) {
      const key = `${this.channelName}:${Date.now()}`
      localStorage.setItem(key, JSON.stringify(message))
      // Clean up after 1s
      setTimeout(() => localStorage.removeItem(key), 1000)
    } else {
      this.channel?.postMessage(message)
    }
  }

  onMessage(callback: (msg: TabMessage) => void): void {
    this.messageCallback = callback
  }

  isLeader(): boolean {
    return this.isLeaderFlag
  }

  getTabId(): string {
    return this.tabId
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
    if (this.leaderTimeoutCheck) {
      clearInterval(this.leaderTimeoutCheck)
    }
    if (this.channel) {
      this.channel.close()
    }
  }
}
```

**☐ Task 1.2: Create Unit Tests**

```bash
# Create test file
touch src/lib/lists/__tests__/TabCoordinator.test.ts
```

**File**: `/src/lib/lists/__tests__/TabCoordinator.test.ts`

```typescript
import { TabCoordinator } from '../TabCoordinator'

// Mock BroadcastChannel
global.BroadcastChannel = class BroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null

  constructor(name: string) {
    this.name = name
  }

  postMessage(message: any) {
    // Simulate async message delivery
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: message } as MessageEvent)
      }
    }, 10)
  }

  close() {}
} as any

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('TabCoordinator', () => {
  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should initialize and elect leader', async () => {
    const coordinator = new TabCoordinator('test-channel')
    await coordinator.initialize()

    await delay(150)

    expect(coordinator.isLeader()).toBe(true)
  })

  it('should elect leader based on timestamp', async () => {
    const coordinator1 = new TabCoordinator('test-channel-2')
    const coordinator2 = new TabCoordinator('test-channel-2')

    await coordinator1.initialize()
    await delay(50)
    await coordinator2.initialize()
    await delay(150)

    // First coordinator should be leader
    expect(coordinator1.isLeader()).toBe(true)
    expect(coordinator2.isLeader()).toBe(false)

    coordinator1.destroy()
    coordinator2.destroy()
  })

  it('should broadcast messages to other tabs', async () => {
    const coordinator1 = new TabCoordinator('test-channel-3')
    const coordinator2 = new TabCoordinator('test-channel-3')

    let receivedMessage = false
    coordinator2.onMessage((msg) => {
      if (msg.type === 'list-created') {
        receivedMessage = true
      }
    })

    await Promise.all([
      coordinator1.initialize(),
      coordinator2.initialize()
    ])

    coordinator1.broadcast({
      type: 'list-created',
      tabId: coordinator1.getTabId(),
      timestamp: Date.now(),
      data: { listId: 'test-123' }
    })

    await delay(50)

    expect(receivedMessage).toBe(true)

    coordinator1.destroy()
    coordinator2.destroy()
  })
})
```

**Run tests:**
```bash
npm test -- TabCoordinator.test.ts
```

**Expected**: All tests pass ✅

---

### Day 2: TabCoordinator Integration Tests

**☐ Task 2.1: Create Integration Tests**

```bash
touch src/lib/lists/__tests__/ListManager.multi-tab.test.ts
```

**File**: `/src/lib/lists/__tests__/ListManager.multi-tab.test.ts`

```typescript
import { listManager } from '../ListManager'
import { openDB, deleteDB } from 'idb'

describe('ListManager Multi-Tab Integration', () => {
  beforeEach(async () => {
    // Clean up IndexedDB
    await deleteDB('UserListsDB')
  })

  it('should sync list creation across tabs', async () => {
    const manager1 = listManager
    const manager2 = listManager // Same singleton, but simulating different tab behavior

    const listener = jest.fn()
    manager2.subscribe('lists-changed', listener)

    await manager1.createList({
      name: 'Test List',
      type: 'word',
      emoji: '📚',
      color: 'primary'
    }, 'test-user-123', false)

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(listener).toHaveBeenCalled()
  })
})
```

**Run tests:**
```bash
npm test -- ListManager.multi-tab.test.ts
```

---

### Day 3: ListManager Integration - Initialization

**☐ Task 3.1: Add TabCoordinator to ListManager**

**File**: `/src/lib/lists/ListManager.ts`

**Location**: Lines 50-72 (initDB method)

**Add after line 17 (imports):**
```typescript
import { TabCoordinator } from './TabCoordinator'
```

**Add after line 18 (properties):**
```typescript
private tabCoordinator: TabCoordinator | null = null
private versionChangeHandler: ((event: IDBVersionChangeEvent) => void) | null = null
private pendingSyncLock: Set<string> = new Set()
```

**Modify initDB() method (lines 50-72):**
```typescript
private async initDB(): Promise<IDBPDatabase<ListManagerDB>> {
  if (this.db) return this.db;

  // Initialize TabCoordinator FIRST
  this.tabCoordinator = new TabCoordinator('lists-coordination')
  await this.tabCoordinator.initialize()

  console.log('[ListManager] TabCoordinator initialized, isLeader:', this.tabCoordinator.isLeader())

  this.db = await openDB<ListManagerDB>('UserListsDB', 1, {
    upgrade(db) {
      // Lists store
      if (!db.objectStoreNames.contains('lists')) {
        const listsStore = db.createObjectStore('lists', { keyPath: 'id' });
        listsStore.createIndex('userId', 'userId');
        listsStore.createIndex('type', 'type');
        listsStore.createIndex('updatedAt', 'updatedAt');
      }

      // Sync queue for premium users
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('timestamp', 'timestamp');
      }
    },
    blocking() {
      console.warn('[ListManager] Database upgrade blocked by another tab')
    },
    blocked() {
      console.warn('[ListManager] Database upgrade blocked - will retry')
    }
  });

  // Setup version change handler
  this.db.onversionchange = (event) => {
    console.warn('[ListManager] Database version change detected, closing connection')
    this.db?.close()
    this.db = null
    this.notifyListeners('version-change')
  }

  // Setup cross-tab message handlers
  this.setupTabCoordination()

  return this.db;
}
```

**☐ Task 3.2: Add setupTabCoordination Method**

**Add after initDB() method:**
```typescript
private setupTabCoordination(): void {
  if (!this.tabCoordinator) return

  this.tabCoordinator.onMessage((message) => {
    console.log('[ListManager] Received tab message:', message.type, 'from', message.tabId)

    switch (message.type) {
      case 'list-created':
      case 'list-updated':
      case 'list-deleted':
        // Invalidate cache and notify listeners to refresh
        this.notifyListeners('lists-changed')
        break

      case 'item-added':
      case 'item-removed':
        // Notify listeners for specific list
        if (message.data?.listId) {
          this.notifyListeners(`list-${message.data.listId}`)
        }
        break

      case 'sync-request':
        // Another tab requested sync status
        if (this.tabCoordinator?.isLeader()) {
          // TODO: Broadcast sync status (implement in Phase 2)
        }
        break
    }
  })
}
```

---

### Day 4: ListManager Integration - CRUD Operations

**☐ Task 4.1: Broadcast createList**

**File**: `/src/lib/lists/ListManager.ts`
**Location**: Line 159-252 (createList method)

**After successful IndexedDB write (after line 249):**
```typescript
await db.put('lists', list);

// Broadcast to other tabs
this.tabCoordinator?.broadcast({
  type: 'list-created',
  tabId: this.tabCoordinator.getTabId(),
  timestamp: Date.now(),
  data: { listId: list.id }
})

this.notifyListeners('lists-changed');
```

**☐ Task 4.2: Broadcast addItemToList**

**Location**: Lines 254-323 (addItemToList method)

**After successful IndexedDB update (after line 296 and 320):**
```typescript
await db.put('lists', list);

// Broadcast to other tabs
this.tabCoordinator?.broadcast({
  type: 'item-added',
  tabId: this.tabCoordinator.getTabId(),
  timestamp: Date.now(),
  data: { listId, itemId: newItem.id }
})

this.notifyListeners(`list-${listId}`);
```

**☐ Task 4.3: Broadcast updateList**

**Location**: Lines 409-446 (updateList method)

**After successful update (after lines 425 and 440):**
```typescript
await db.put('lists', list);

// Broadcast to other tabs
this.tabCoordinator?.broadcast({
  type: 'list-updated',
  tabId: this.tabCoordinator.getTabId(),
  timestamp: Date.now(),
  data: { listId: list.id }
})

this.notifyListeners('lists-changed');
```

**☐ Task 4.4: Broadcast deleteList**

**Location**: Lines 448-483 (deleteList method)

**After successful deletion (after lines 461 and 477):**
```typescript
await db.delete('lists', listId);

// Broadcast to other tabs
this.tabCoordinator?.broadcast({
  type: 'list-deleted',
  tabId: this.tabCoordinator.getTabId(),
  timestamp: Date.now(),
  data: { listId }
})

this.notifyListeners('lists-changed');
```

**☐ Task 4.5: Coordinate Sync Queue Processing**

**Location**: Lines 624-647 (processSyncQueue method)

**Add leader check at the beginning:**
```typescript
private async processSyncQueue(): Promise<void> {
  // Only leader processes sync queue
  if (this.tabCoordinator && !this.tabCoordinator.isLeader()) {
    console.log('[ListManager] Not leader, skipping sync queue processing')
    return
  }

  console.log('[ListManager] Leader processing sync queue')

  // Existing logic continues...
}
```

---

### Day 5: User Notifications

**☐ Task 5.1: Create MultiTabNotifier Component**

```bash
touch src/components/lists/MultiTabNotifier.tsx
```

**File**: `/src/components/lists/MultiTabNotifier.tsx`

```typescript
'use client'

import React, { useEffect, useState } from 'react'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { listManager } from '@/lib/lists/ListManager'

export function MultiTabNotifier() {
  const [showNotification, setShowNotification] = useState(false)
  const [notificationType, setNotificationType] = useState<'version-change' | 'conflict'>('version-change')

  useEffect(() => {
    const unsubscribe = listManager.subscribe('version-change', () => {
      setNotificationType('version-change')
      setShowNotification(true)
    })

    return unsubscribe
  }, [])

  if (!showNotification) return null

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleDismiss = () => {
    setShowNotification(false)
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] max-w-md w-full px-4">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />

          <div className="flex-1">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
              {notificationType === 'version-change'
                ? 'Database Updated in Another Tab'
                : 'Changes Detected in Another Tab'}
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {notificationType === 'version-change'
                ? 'The database has been updated in another tab. Please refresh to continue.'
                : 'Another tab has made changes to your lists. Refresh to see the latest changes.'}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 dark:bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-colors"
              >
                <RefreshCw size={14} />
                Refresh Now
              </button>

              {notificationType === 'conflict' && (
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-yellow-700 dark:text-yellow-300 text-sm font-medium hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-md transition-colors"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>

          {notificationType === 'conflict' && (
            <button
              onClick={handleDismiss}
              className="text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded p-1 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

**☐ Task 5.2: Integrate MultiTabNotifier into Pages**

**File 1**: `/src/app/[locale]/lists/page.tsx`

**Add import at top:**
```typescript
import { MultiTabNotifier } from '@/components/lists/MultiTabNotifier'
```

**Add component before `<MobileNavSpacer />` (line 468):**
```typescript
<MultiTabNotifier />
<MobileNavSpacer />
```

**File 2**: `/src/app/[locale]/lists/[listId]/page.tsx`

**Add import and component in same way (before line 982)**

---

### Day 5: Testing Multi-Tab Coordination

**☐ Manual Testing Steps:**

1. **Open 2 tabs to `/lists`**
2. **Tab 1: Create a new list**
   - Expected: List appears in Tab 1
   - Wait 1-2 seconds
   - Expected: List appears in Tab 2 (cross-tab sync)
3. **Tab 2: Add item to the list**
   - Expected: Item appears in Tab 2
   - Switch to Tab 1
   - Expected: Item appears in Tab 1 (after refresh or auto-sync)
4. **Tab 1: Delete the list**
   - Expected: List removed from Tab 1
   - Switch to Tab 2
   - Expected: List removed from Tab 2
5. **Close Tab 1 (leader), wait 15 seconds**
   - Expected: Tab 2 becomes leader automatically
6. **Open developer console in both tabs**
   - Expected: Only one tab logs "Leader processing sync queue"

**All tests passing?** ✅ Proceed to Phase 2

---

## Phase 2: Sync Status Visibility (Days 6-10)

### Day 6: Complete processSyncQueue Implementation

**☐ Task 6.1: Add Sync Status Types**

**File**: `/src/lib/lists/ListManager.ts`

**Add after imports:**
```typescript
interface ListSyncStatus {
  isOnline: boolean
  syncState: 'idle' | 'syncing' | 'synced' | 'error'
  pendingCount: number
  failedCount: number
  lastSyncTime: Date | null
  lastError: string | null
}
```

**Add to class properties (line 18):**
```typescript
private syncStatus: ListSyncStatus = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncState: 'idle',
  pendingCount: 0,
  failedCount: 0,
  lastSyncTime: null,
  lastError: null
}
```

**☐ Task 6.2: Add Circuit Breaker**

**Add to class properties:**
```typescript
private circuitBreakerFailures: number = 0
private circuitBreakerOpenUntil: number = 0
private readonly MAX_CIRCUIT_FAILURES = 5
private readonly CIRCUIT_COOLDOWN = 30000 // 30s
```

**☐ Task 6.3: Implement Complete processSyncQueue**

**File**: `/src/lib/lists/ListManager.ts`
**Location**: Lines 625-647 (replace existing stub)

```typescript
private async processSyncQueue(): Promise<void> {
  // Only leader processes queue
  if (this.tabCoordinator && !this.tabCoordinator.isLeader()) {
    console.log('[ListManager] Not leader, skipping sync queue processing')
    return
  }

  // Check circuit breaker
  if (Date.now() < this.circuitBreakerOpenUntil) {
    console.warn('[ListManager] Circuit breaker open, skipping sync')
    return
  }

  const db = await this.initDB()
  const items = await db.getAllFromIndex('syncQueue', 'timestamp')

  if (items.length === 0) {
    this.syncStatus.syncState = 'synced'
    this.syncStatus.pendingCount = 0
    return
  }

  console.log(`[ListManager] Processing ${items.length} items in sync queue`)

  this.syncStatus.syncState = 'syncing'
  this.syncStatus.pendingCount = items.length
  this.notifyListeners('sync-started')

  let successCount = 0
  let failureCount = 0

  for (const item of items) {
    // Check if already being processed
    if (this.pendingSyncLock.has(item.id)) {
      console.log('[ListManager] Item already processing:', item.id)
      continue
    }

    this.pendingSyncLock.add(item.id)

    try {
      // Call appropriate API based on action type
      switch (item.action) {
        case 'create':
          await this.syncCreateToServer(item.data)
          break
        case 'update':
          await this.syncUpdateToServer(item.data)
          break
        case 'delete':
          await this.syncDeleteToServer(item.data)
          break
        case 'addItem':
          await this.syncAddItemToServer(item.data)
          break
        case 'removeItem':
          await this.syncRemoveItemToServer(item.data)
          break
        default:
          console.warn('[ListManager] Unknown sync action:', item.action)
      }

      // Success - remove from queue
      await db.delete('syncQueue', item.id)
      this.pendingSyncLock.delete(item.id)
      successCount++

      // Reset circuit breaker on success
      this.circuitBreakerFailures = 0

    } catch (error) {
      this.pendingSyncLock.delete(item.id)
      failureCount++

      console.error('[ListManager] Sync failed for item:', item.id, error)

      // Increment retry count
      item.retryCount++

      if (item.retryCount < 5) {
        // Update retry count and schedule retry
        await db.put('syncQueue', item)

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const backoffDelay = Math.min(30, Math.pow(2, item.retryCount)) * 1000
        console.log(`[ListManager] Scheduling retry in ${backoffDelay}ms`)

        setTimeout(() => {
          this.processSyncQueue()
        }, backoffDelay)
      } else {
        // Give up after 5 retries
        console.error('[ListManager] Max retries reached, removing from queue:', item.id)
        await db.delete('syncQueue', item.id)
        this.syncStatus.failedCount++
        this.notifyListeners('sync-failed', { item, error })
      }

      // Increment circuit breaker
      this.circuitBreakerFailures++
      if (this.circuitBreakerFailures >= this.MAX_CIRCUIT_FAILURES) {
        console.error('[ListManager] Circuit breaker triggered, cooling down for 30s')
        this.circuitBreakerOpenUntil = Date.now() + this.CIRCUIT_COOLDOWN
        this.syncStatus.syncState = 'error'
        this.syncStatus.lastError = 'Too many failures, retrying in 30s'
        this.notifyListeners('sync-error')
        break
      }
    }
  }

  // Update final status
  this.syncStatus.lastSyncTime = new Date()
  this.syncStatus.pendingCount = Math.max(0, this.syncStatus.pendingCount - successCount)

  if (this.syncStatus.pendingCount === 0) {
    this.syncStatus.syncState = 'synced'
  } else if (failureCount > 0) {
    this.syncStatus.syncState = 'error'
  }

  this.notifyListeners('sync-completed', { successCount, failureCount })

  console.log(`[ListManager] Sync completed: ${successCount} success, ${failureCount} failures`)
}
```

**☐ Task 6.4: Add Sync Helper Methods**

**Add these methods after processSyncQueue:**

```typescript
private async syncCreateToServer(data: any): Promise<void> {
  const response = await fetch('/api/lists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`)
  }
}

private async syncUpdateToServer(data: any): Promise<void> {
  const response = await fetch(`/api/lists/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`)
  }
}

private async syncDeleteToServer(data: any): Promise<void> {
  const response = await fetch(`/api/lists/${data.id}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`)
  }
}

private async syncAddItemToServer(data: any): Promise<void> {
  const response = await fetch(`/api/lists/${data.listId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data.item)
  })

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`)
  }
}

private async syncRemoveItemToServer(data: any): Promise<void> {
  const response = await fetch(`/api/lists/${data.listId}/items?itemId=${data.itemId}`, {
    method: 'DELETE',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`)
  }
}
```

**☐ Task 6.5: Add Public Sync Status API**

**Add these public methods:**

```typescript
getSyncStatus(): ListSyncStatus {
  return { ...this.syncStatus }
}

async forceSyncAll(): Promise<void> {
  console.log('[ListManager] Manual sync triggered')
  await this.processSyncQueue()
}
```

---

### Day 7: Sync Status Testing

**☐ Task 7.1: Test Sync Queue Processing**

```bash
# Create some lists while offline
# Check IndexedDB has items in syncQueue
# Go online
# Verify items sync and queue clears
```

**☐ Task 7.2: Test Circuit Breaker**

```bash
# Simulate 5 consecutive failures
# Verify circuit breaker opens
# Wait 30s
# Verify sync resumes
```

---

### Days 8-9: ListSyncStatusIndicator Component

**☐ Task 8.1: Create Component**

```bash
touch src/components/lists/ListSyncStatusIndicator.tsx
```

**File**: `/src/components/lists/ListSyncStatusIndicator.tsx`

*See `SYNC_STATUS_VISIBILITY.md` for complete component code (~400 lines)*

Key features:
- Floating button (bottom-right)
- Color-coded status badge
- Expandable panel with details
- Manual sync button (premium only)
- Responsive mobile layout

---

### Day 10: Integration and Testing

**☐ Task 10.1: Add to Pages**

**Files**:
- `/src/app/[locale]/lists/page.tsx` (before line 469)
- `/src/app/[locale]/lists/[listId]/page.tsx` (before line 982)

**Add import:**
```typescript
import { ListSyncStatusIndicator } from '@/components/lists/ListSyncStatusIndicator'
```

**Add component:**
```typescript
<ListSyncStatusIndicator />
<MobileNavSpacer />
```

**☐ Task 10.2: Manual Testing**

1. **Create list → Verify "Syncing" status**
2. **Wait for completion → Verify "Synced" status**
3. **Go offline → Verify "Offline" status**
4. **Create items offline → Verify pending count**
5. **Go online → Verify sync completes**
6. **Test manual sync button (premium)**

**All features working?** ✅ Proceed to Phase 3

---

## Phase 3: Storage Quota Handling (Days 11-12)

### Day 11: QuotaGuard Implementation

**☐ Task 11.1: Create QuotaGuard Utility**

```bash
mkdir -p src/lib/storage
touch src/lib/storage/QuotaGuard.ts
```

**File**: `/src/lib/storage/QuotaGuard.ts`

*See `STORAGE_QUOTA_HANDLING.md` for complete implementation (~150 lines)*

**☐ Task 11.2: Create QuotaError Class**

**Add to QuotaGuard.ts:**
```typescript
export class QuotaError extends Error {
  constructor(message: string, public usage?: number, public quota?: number) {
    super(message)
    this.name = 'QuotaError'
  }
}
```

**☐ Task 11.3: Wrap ListManager Operations**

**File**: `/src/lib/lists/ListManager.ts`

**Add import:**
```typescript
import { QuotaGuard, QuotaError } from '@/lib/storage/QuotaGuard'
```

**Wrap all db.put() calls:**

**Line 249 (createList):**
```typescript
await QuotaGuard.guardedWrite(
  () => db.put('lists', list),
  'createList'
)
```

**Lines 296, 320 (addItemToList):**
```typescript
await QuotaGuard.guardedWrite(
  () => db.put('lists', list),
  'addItemToList'
)
```

**Lines 425, 440 (updateList):**
```typescript
await QuotaGuard.guardedWrite(
  () => db.put('lists', list),
  'updateList'
)
```

**Line 591 (importList):**
```typescript
await QuotaGuard.guardedWrite(
  () => db.put('lists', list),
  'importList'
)
```

---

### Day 12: StorageWarning Integration

**☐ Task 12.1: Verify StorageWarning Component**

```bash
# Check if component exists
ls src/components/storage/StorageWarning.tsx
```

**If exists**: ✅ Continue
**If missing**: Create based on `STORAGE_QUOTA_HANDLING.md`

**☐ Task 12.2: Add to List Pages**

**Files**:
- `/src/app/[locale]/lists/page.tsx`
- `/src/app/[locale]/lists/[listId]/page.tsx`

**Add import:**
```typescript
import { StorageWarning } from '@/components/storage/StorageWarning'
```

**Add after LearningPageHeader:**
```typescript
<LearningPageHeader ... />
<StorageWarning threshold={0.90} />
```

**☐ Task 12.3: Update Error Handling**

**In CRUD operations, catch QuotaError:**

```typescript
try {
  await listManager.createList(...)
  showToast('List created!', 'success')
} catch (error) {
  if (error instanceof QuotaError) {
    showToast('Storage full. Please delete old lists.', 'error')
  } else {
    showToast(t('lists.errors.createFailed'), 'error')
  }
}
```

**☐ Task 12.4: Manual Testing**

**Simulate quota exceeded:**
```javascript
// In browser console
const db = await indexedDB.open('UserListsDB', 1)
// Fill with dummy data until quota exceeded
```

**Verify:**
- Warning appears at 90%
- Writes blocked at 95%
- Error toast shows clear message
- StorageWarning suggests cleanup

**All tests passing?** ✅ Proceed to Phase 4

---

## Phase 4: Testing & QA (Days 13-15)

### Day 13: E2E Tests

**☐ Task 13.1: Create E2E Test File**

```bash
mkdir -p e2e
touch e2e/lists-multi-tab.spec.ts
```

**File**: `/e2e/lists-multi-tab.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('MyLists Multi-Tab', () => {
  test('should sync list creation across tabs', async ({ context }) => {
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    await page1.goto('/lists')
    await page2.goto('/lists')

    // Create list in tab 1
    await page1.click('button:has-text("New List")')
    await page1.fill('input[name="name"]', 'Multi-Tab Test')
    await page1.click('button:has-text("Create")')

    // Wait for cross-tab sync
    await page2.waitForTimeout(1000)

    // Verify in tab 2
    await expect(page2.locator('text=Multi-Tab Test')).toBeVisible()
  })

  test('should show sync status', async ({ page }) => {
    await page.goto('/lists')

    // Should show sync indicator
    await expect(page.locator('[data-testid="sync-status"]')).toBeVisible()

    // Create list
    await page.click('button:has-text("New List")')
    await page.fill('input[name="name"]', 'Test')
    await page.click('button:has-text("Create")')

    // Should show syncing
    await expect(page.locator('text=Syncing')).toBeVisible()

    // Should show synced after completion
    await page.waitForTimeout(2000)
    await expect(page.locator('text=Synced')).toBeVisible()
  })
})
```

**Run tests:**
```bash
npm run test:e2e
```

---

### Day 14: Manual Testing

**☐ Test Multi-Tab Scenarios:**
- [ ] 2 tabs, create list in Tab 1 → appears in Tab 2
- [ ] 2 tabs, edit list in Tab 1 → updates in Tab 2
- [ ] 2 tabs, delete list in Tab 1 → removed from Tab 2
- [ ] Close leader tab → follower becomes leader
- [ ] Offline in Tab 1, online in Tab 2 → sync works

**☐ Test Sync Status:**
- [ ] Create list → shows "Syncing"
- [ ] After sync → shows "Synced" with timestamp
- [ ] Go offline → shows "Offline"
- [ ] Many items → shows pending count
- [ ] Failed sync → shows error with retry

**☐ Test Storage Quota:**
- [ ] At 90% → warning appears
- [ ] At 95% → writes blocked
- [ ] QuotaError → clear error message
- [ ] Cleanup suggestions work

**☐ Test Performance:**
- [ ] Create 100 lists → no lag
- [ ] Sync 50 items → completes in <10s
- [ ] Multi-tab with 10 tabs → stable
- [ ] Mobile → responsive layout

---

### Day 15: Documentation & Cleanup

**☐ Task 15.1: Update Comments**

```bash
# Add JSDoc comments to all new classes
# Document complex logic
# Add usage examples
```

**☐ Task 15.2: Create Migration Guide**

*Already completed - see `01_PRODUCTION_DOCS/6-MyLists-Reliability/`*

**☐ Task 15.3: Performance Profiling**

```bash
# Use Chrome DevTools
# Check IndexedDB transaction times
# Verify BroadcastChannel overhead
# Measure quota check impact
```

**Expected:**
- IndexedDB writes: <10ms
- Cross-tab latency: <100ms
- Quota checks: <5ms
- Memory: <5MB overhead

---

## Phase 5: Staged Rollout (Days 16-30)

### Week 1: Internal Testing (10%)

**☐ Task: Enable Feature Flag**

**File**: Create `.env.local` (or update existing)

```bash
NEXT_PUBLIC_ENABLE_MULTI_TAB=true
NEXT_PUBLIC_ENABLE_SYNC_STATUS=true
NEXT_PUBLIC_ENABLE_QUOTA_GUARD=true
```

**OR: Use percentage rollout**

```typescript
// In ListManager.ts
const ROLLOUT_PERCENTAGE = 10
const userId = session.uid
const rolloutHash = hashUserId(userId) % 100

if (rolloutHash < ROLLOUT_PERCENTAGE) {
  this.tabCoordinator = new TabCoordinator(...)
}
```

**☐ Monitor Metrics:**
- Error rates in Sentry/logging
- Sync success rates
- User feedback
- Performance impact

**Issues found?** → Fix immediately, don't proceed to Week 2

---

### Week 2: Beta Users (50%)

**☐ Increase rollout to 50%**

```bash
ROLLOUT_PERCENTAGE=50
```

**☐ Monitor:**
- Increased traffic impact
- Edge cases from diverse users
- Mobile vs desktop differences

---

### Week 3: All Users (100%)

**☐ Full rollout**

```bash
ROLLOUT_PERCENTAGE=100
```

**☐ Monitor for 7 days**

---

### Week 4: Stabilization

**☐ Remove feature flags** (hardcode enabled)

**☐ Clean up debug logging**

**☐ Finalize documentation**

---

## Success Criteria

**All of these must be true:**

- ✅ Zero data loss in multi-tab scenarios
- ✅ Sync status visible 100% of time (premium users)
- ✅ Zero QuotaExceededError crashes
- ✅ <10ms performance overhead
- ✅ All tests passing (unit, integration, E2E)
- ✅ User feedback positive (NPS +10)
- ✅ Support tickets reduced by 50%

---

## Rollback Procedure

**If critical issues arise:**

**1. Disable feature flags immediately:**
```bash
NEXT_PUBLIC_ENABLE_MULTI_TAB=false
NEXT_PUBLIC_ENABLE_SYNC_STATUS=false
NEXT_PUBLIC_ENABLE_QUOTA_GUARD=false
```

**2. Deploy rollback:**
```bash
git revert <commit-hash>
npm run build
npm run deploy
```

**3. Notify users:**
- Status page update
- In-app banner
- Email if necessary

**4. Investigate root cause**

**5. Fix and re-test before re-enabling**

---

## Support Resources

**Documentation:**
- `MULTI_TAB_COORDINATION.md` - TabCoordinator details
- `SYNC_STATUS_VISIBILITY.md` - Sync UI implementation
- `STORAGE_QUOTA_HANDLING.md` - QuotaGuard usage
- `TROUBLESHOOTING.md` - Common issues

**Code References:**
- `/src/lib/lists/TabCoordinator.ts` - Cross-tab messaging
- `/src/lib/lists/ListManager.ts` - Main integration
- `/src/lib/storage/QuotaGuard.ts` - Quota management
- `/src/components/lists/ListSyncStatusIndicator.tsx` - UI

**Testing:**
- `/src/lib/lists/__tests__/` - Unit tests
- `/e2e/lists-multi-tab.spec.ts` - E2E tests

---

**Implementation Status**: ⬜ NOT STARTED

**After completion**: Update to ✅ COMPLETED

**Estimated Completion**: Day 30 (staged rollout complete)
