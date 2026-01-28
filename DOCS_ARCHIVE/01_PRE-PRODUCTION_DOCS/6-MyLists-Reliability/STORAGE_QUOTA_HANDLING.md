# Storage Quota Handling - Technical Documentation

**Feature**: Graceful Storage Quota Management for MyLists
**Priority**: HIGH - Prevents App Crashes
**Component**: QuotaGuard
**Status**: PLANNED

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [QuotaGuard Utility](#quotaguard-utility)
4. [StorageWarning Integration](#storagewarning-integration)
5. [Error Handling Strategy](#error-handling-strategy)
6. [Cleanup Suggestions](#cleanup-suggestions)
7. [User Guidance](#user-guidance)
8. [Testing Strategies](#testing-strategies)
9. [Performance Considerations](#performance-considerations)
10. [Common Pitfalls](#common-pitfalls)

---

## Problem Statement

### Current Behavior

IndexedDB operations fail silently when browser storage quota is exceeded:

1. **No Pre-Check**: ListManager writes to IndexedDB without checking available space
2. **Uncaught Exception**: `QuotaExceededError` crashes the app (unhandled)
3. **Silent Data Loss**: User thinks operation succeeded, but nothing was saved
4. **No User Warning**: No feedback when approaching quota limits
5. **No Recovery Options**: User doesn't know how to free up space

### Browser Storage Quotas

Different browsers have different quota limits:

| Browser | Storage Limit | Formula |
|---------|--------------|---------|
| Chrome | 60% of disk space | `min(diskSize * 0.6, 2GB)` per origin |
| Firefox | 50% of disk space | 10% per origin, up to 2GB |
| Safari | 1GB total | Shared across all sites |
| Edge | 60% of disk space | Same as Chrome (Chromium-based) |

**Typical Free User Storage Needs**:
- 3 lists × 100 items each = ~300KB
- Sync queue (offline changes) = ~50KB
- Total: **~350KB** (well under limits)

**Power User Storage Needs** (Premium):
- 50 lists × 500 items each = ~7MB
- Sync queue (large backlog) = ~500KB
- Total: **~7.5MB** (still comfortable)

**Problem Scenario**: User has **multiple sites** storing data → aggregate quota exceeded

### User Impact Stories

```
User Story 1: Silent Failure
"I added 100 words to my list, clicked save.
The app showed 'List updated!' but when I refreshed,
nothing was there. Turns out my storage was full."

User Story 2: App Crash
"The app froze and showed a white screen.
Console said 'QuotaExceededError'.
I had to clear ALL my browser data to fix it."

User Story 3: No Guidance
"I got a 'storage full' error.
The app didn't tell me what to delete or how much space I need.
I just uninstalled the app."
```

### Business Impact

- **Churn**: Users abandon app after data loss or crashes
- **Support Load**: 15% of tickets related to "app not saving"
- **Reputation**: Poor reviews mentioning crashes and data loss
- **Free User Impact**: Disproportionately affects free users (no cloud backup)

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                  User Action (Create/Update)             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               QuotaGuard.guardedWrite()                  │
│                                                           │
│  1. Pre-Check: navigator.storage.estimate()             │
│     ├─ <90%  → Proceed                                  │
│     ├─ 90-95% → Warning toast                           │
│     └─ >95%  → Block operation, show error             │
│                                                           │
│  2. Execute: await operation()                          │
│                                                           │
│  3. Catch: QuotaExceededError                           │
│     └─ Show cleanup modal                               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 IndexedDB Write                          │
│  ✅ Success → Return result                             │
│  ❌ QuotaExceededError → Throw QuotaError               │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│            Error Handling in UI Layer                    │
│                                                           │
│  if (error instanceof QuotaError):                       │
│    → Show "Storage Full" toast                          │
│    → Display StorageWarning component                   │
│    → Offer cleanup suggestions                          │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **QuotaGuard**: Utility class for quota management
2. **QuotaError**: Custom error type for quota exceeded scenarios
3. **StorageWarning**: Component showing quota usage and cleanup options
4. **CleanupModal**: Interactive cleanup wizard (optional, future enhancement)

### Design Principles

- **Proactive Prevention**: Check quota BEFORE writing
- **User Transparency**: Clear feedback on storage usage
- **Graceful Degradation**: App remains functional even when quota full
- **Guided Recovery**: Help users free up space
- **No Surprises**: Warn users before they hit limits

---

## QuotaGuard Utility

### File Structure

```
/src/lib/storage/QuotaGuard.ts (NEW FILE)
├── QuotaGuard class (static methods)
├── QuotaError class (custom error)
├── QuotaStatus interface
└── CleanupSuggestion interface
```

### Implementation

```typescript
// /src/lib/storage/QuotaGuard.ts

/**
 * QuotaGuard - Storage quota management utility
 *
 * Features:
 * - Pre-operation quota checking (90% warning, 95% block)
 * - Post-operation error handling (catch QuotaExceededError)
 * - Cleanup suggestions based on storage analysis
 * - Graceful degradation when quota unavailable
 *
 * @example
 * await QuotaGuard.guardedWrite(
 *   () => db.put('lists', list),
 *   'createList'
 * )
 */
export class QuotaGuard {
  // Thresholds
  private static readonly WARNING_THRESHOLD = 0.90   // 90% - show warning
  private static readonly BLOCK_THRESHOLD = 0.95     // 95% - block writes
  private static readonly CRITICAL_THRESHOLD = 0.98  // 98% - force cleanup

  /**
   * Check current storage quota status
   *
   * @returns QuotaStatus object with usage info
   */
  static async checkQuota(): Promise<QuotaStatus> {
    // Check if Storage API is available
    if (!navigator.storage?.estimate) {
      console.warn('[QuotaGuard] Storage API not available, assuming quota OK')
      return {
        available: true,
        usage: 0,
        quota: 0,
        percentage: 0,
        warning: false,
        critical: false
      }
    }

    try {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      const percentage = quota > 0 ? usage / quota : 0

      return {
        available: percentage < this.BLOCK_THRESHOLD,
        usage,
        quota,
        percentage,
        warning: percentage >= this.WARNING_THRESHOLD,
        critical: percentage >= this.CRITICAL_THRESHOLD
      }
    } catch (error) {
      console.error('[QuotaGuard] Failed to check quota:', error)
      // Assume quota OK on error (fail open)
      return {
        available: true,
        usage: 0,
        quota: 0,
        percentage: 0,
        warning: false,
        critical: false
      }
    }
  }

  /**
   * Execute IndexedDB write operation with quota protection
   *
   * @param operation - Async function that writes to IndexedDB
   * @param context - Description of operation (for logging)
   * @returns Result of operation
   * @throws QuotaError if quota exceeded
   *
   * @example
   * const list = await QuotaGuard.guardedWrite(
   *   () => db.put('lists', newList),
   *   'createList'
   * )
   */
  static async guardedWrite<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    // 1. Pre-operation quota check
    const status = await this.checkQuota()

    // Block if critical threshold exceeded
    if (status.critical || !status.available) {
      const usedMB = (status.usage / (1024 * 1024)).toFixed(1)
      const quotaMB = (status.quota / (1024 * 1024)).toFixed(1)

      throw new QuotaError(
        `Storage quota exceeded (${usedMB}MB / ${quotaMB}MB used). Please free up space.`,
        status
      )
    }

    // Warn if approaching threshold
    if (status.warning) {
      const percentage = (status.percentage * 100).toFixed(1)
      console.warn(
        `[QuotaGuard] ${context} - Storage ${percentage}% full`,
        `(${(status.usage / (1024 * 1024)).toFixed(1)}MB used)`
      )
    }

    // 2. Execute operation with error handling
    try {
      return await operation()

    } catch (error) {
      // Catch QuotaExceededError specifically
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        const status = await this.checkQuota()
        throw new QuotaError(
          'Storage quota exceeded during write operation. Please delete old data.',
          status,
          error
        )
      }

      // Re-throw other errors
      throw error
    }
  }

  /**
   * Analyze storage and suggest cleanup actions
   *
   * @returns Array of cleanup suggestions sorted by impact
   */
  static async suggestCleanup(): Promise<CleanupSuggestion[]> {
    const suggestions: CleanupSuggestion[] = []

    try {
      // Open IndexedDB to analyze storage
      const { openDB } = await import('idb')
      const db = await openDB('user-lists', 1)

      // 1. Analyze sync queue (old failed items)
      const syncQueue = await db.getAll('syncQueue')
      const oldSyncItems = syncQueue.filter(item =>
        item.retryCount >= 3 || (Date.now() - item.timestamp) > 7 * 24 * 60 * 60 * 1000  // 7 days old
      )

      if (oldSyncItems.length > 0) {
        const estimatedSize = oldSyncItems.length * 5 * 1024  // ~5KB per item
        suggestions.push({
          type: 'clear-sync-queue',
          description: `Clear ${oldSyncItems.length} failed sync items`,
          estimatedSpace: estimatedSize,
          priority: 'high',
          action: async () => {
            for (const item of oldSyncItems) {
              await db.delete('syncQueue', item.id)
            }
          }
        })
      }

      // 2. Analyze lists (very old or large lists)
      const lists = await db.getAll('lists')
      const oldLists = lists.filter(list =>
        (Date.now() - list.updatedAt) > 90 * 24 * 60 * 60 * 1000  // 90 days old
      )

      if (oldLists.length > 0) {
        const estimatedSize = oldLists.reduce((sum, list) =>
          sum + (list.items?.length || 0) * 2 * 1024,  // ~2KB per item
          0
        )
        suggestions.push({
          type: 'delete-old-lists',
          description: `Delete ${oldLists.length} lists not updated in 90+ days`,
          estimatedSpace: estimatedSize,
          priority: 'medium',
          action: async () => {
            for (const list of oldLists) {
              await db.delete('lists', list.id)
            }
          }
        })
      }

      // 3. Suggest exporting and clearing all data
      const allLists = await db.getAll('lists')
      if (allLists.length > 0) {
        const estimatedSize = allLists.reduce((sum, list) =>
          sum + (list.items?.length || 0) * 2 * 1024,
          0
        )
        suggestions.push({
          type: 'export-and-clear',
          description: `Export all lists and clear local storage`,
          estimatedSpace: estimatedSize,
          priority: 'low',
          action: async () => {
            // Export logic would be handled by UI
            throw new Error('User must manually export before clearing')
          }
        })
      }

      return suggestions.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })

    } catch (error) {
      console.error('[QuotaGuard] Failed to analyze storage:', error)
      return []
    }
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

/**
 * Custom error for quota exceeded scenarios
 */
export class QuotaError extends Error {
  public readonly quotaStatus: QuotaStatus
  public readonly cause?: Error

  constructor(message: string, quotaStatus: QuotaStatus, cause?: Error) {
    super(message)
    this.name = 'QuotaError'
    this.quotaStatus = quotaStatus
    this.cause = cause
  }
}

/**
 * Storage quota status
 */
export interface QuotaStatus {
  available: boolean         // Can write more data
  usage: number              // Bytes used
  quota: number              // Total bytes available
  percentage: number         // Usage ratio (0-1)
  warning: boolean           // >=90% full
  critical: boolean          // >=98% full
}

/**
 * Cleanup suggestion
 */
export interface CleanupSuggestion {
  type: 'clear-sync-queue' | 'delete-old-lists' | 'export-and-clear'
  description: string        // User-friendly description
  estimatedSpace: number     // Bytes that would be freed
  priority: 'high' | 'medium' | 'low'
  action: () => Promise<void>  // Function to execute cleanup
}
```

---

## StorageWarning Integration

### Existing Component

The app already has a `StorageWarning` component at `/src/components/storage/StorageWarning.tsx`. We need to:

1. **Verify Compatibility**: Ensure it works with Lists feature
2. **Integrate into Pages**: Add to lists pages
3. **Enhance with Cleanup**: Add cleanup suggestions from QuotaGuard

### Integration Steps

#### Step 1: Add to Lists Overview Page

```typescript
// /src/app/[locale]/lists/page.tsx

import { StorageWarning } from '@/components/storage/StorageWarning'

export default function ListsPage() {
  return (
    <div className="min-h-screen">
      <LearningPageHeader title={t('lists.title')} showBackButton={false} />

      {/* === NEW: Storage Warning === */}
      <StorageWarning threshold={0.90} />

      {/* List grid */}
      <div className="p-4">
        {/* ... existing list cards ... */}
      </div>

      <ListSyncStatusIndicator />
      <MobileNavSpacer />
    </div>
  )
}
```

#### Step 2: Add to List Detail Page

```typescript
// /src/app/[locale]/lists/[listId]/page.tsx

import { StorageWarning } from '@/components/storage/StorageWarning'

export default function ListDetailPage({ params }: { params: { listId: string } }) {
  return (
    <div className="min-h-screen">
      <LearningPageHeader title={list?.name || 'Loading...'} showBackButton />

      {/* === NEW: Storage Warning === */}
      <StorageWarning threshold={0.90} />

      {/* List items */}
      <div className="p-4">
        {/* ... existing list items ... */}
      </div>

      <ListSyncStatusIndicator />
      <MobileNavSpacer />
    </div>
  )
}
```

#### Step 3: Enhanced StorageWarning with Cleanup

If the existing component doesn't support cleanup suggestions, enhance it:

```typescript
// /src/components/storage/StorageWarning.tsx (ENHANCED)

'use client'

import { useState, useEffect } from 'react'
import { QuotaGuard, CleanupSuggestion } from '@/lib/storage/QuotaGuard'
import type { QuotaStatus } from '@/lib/storage/QuotaGuard'

interface StorageWarningProps {
  threshold?: number  // Default 0.90 (90%)
}

export function StorageWarning({ threshold = 0.90 }: StorageWarningProps) {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null)
  const [suggestions, setSuggestions] = useState<CleanupSuggestion[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  useEffect(() => {
    checkQuota()

    // Re-check every 30s
    const interval = setInterval(checkQuota, 30000)

    return () => clearInterval(interval)
  }, [])

  const checkQuota = async () => {
    const status = await QuotaGuard.checkQuota()
    setQuotaStatus(status)

    // Load cleanup suggestions if warning threshold exceeded
    if (status.percentage >= threshold) {
      const suggestions = await QuotaGuard.suggestCleanup()
      setSuggestions(suggestions)
    }
  }

  const handleCleanup = async (suggestion: CleanupSuggestion) => {
    setIsCleaningUp(true)

    try {
      await suggestion.action()
      await checkQuota()  // Refresh status
      // Show success toast
    } catch (error) {
      console.error('[StorageWarning] Cleanup failed:', error)
      // Show error toast
    } finally {
      setIsCleaningUp(false)
    }
  }

  // Don't show if below threshold
  if (!quotaStatus || quotaStatus.percentage < threshold) {
    return null
  }

  const usedMB = (quotaStatus.usage / (1024 * 1024)).toFixed(1)
  const quotaMB = (quotaStatus.quota / (1024 * 1024)).toFixed(1)
  const percentage = (quotaStatus.percentage * 100).toFixed(0)

  return (
    <div className="mx-4 my-4">
      {/* Warning Banner */}
      <div
        className={`rounded-lg p-4 ${
          quotaStatus.critical
            ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-sm mb-1">
              {quotaStatus.critical ? '⚠️ Storage Almost Full' : '⚠️ Storage Running Low'}
            </h3>
            <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
              Using {usedMB}MB of {quotaMB}MB ({percentage}% full)
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full ${
                  quotaStatus.critical ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(quotaStatus.percentage * 100, 100)}%` }}
              />
            </div>

            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs font-medium underline"
              >
                View cleanup suggestions
              </button>
            )}
          </div>

          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              ✕
            </button>
          )}
        </div>

        {/* Cleanup Suggestions */}
        {isExpanded && suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold text-xs mb-2">Cleanup Suggestions:</h4>

            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-3"
              >
                <div className="flex-1">
                  <p className="text-xs font-medium">{suggestion.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Frees up ~{QuotaGuard.formatBytes(suggestion.estimatedSpace)}
                  </p>
                </div>

                <button
                  onClick={() => handleCleanup(suggestion)}
                  disabled={isCleaningUp}
                  className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCleaningUp ? 'Cleaning...' : 'Clean Up'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* No suggestions available */}
        {isExpanded && suggestions.length === 0 && (
          <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
            <p>No automatic cleanup suggestions available.</p>
            <p className="mt-2">
              Try clearing browser cache or deleting lists manually.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## Error Handling Strategy

### Wrap All IndexedDB Writes

Update ListManager to use QuotaGuard for all `db.put()` operations:

```typescript
// /src/lib/lists/ListManager.ts

import { QuotaGuard, QuotaError } from '@/lib/storage/QuotaGuard'

class ListManager {
  /**
   * Create new list (with quota protection)
   */
  async createList(data: CreateListRequest): Promise<UserList> {
    // ... validation logic ...

    const db = await this.initDB()

    // === WRAP WITH QUOTAGUARD ===
    await QuotaGuard.guardedWrite(
      () => db.put('lists', list),
      'createList'
    )

    // ... rest of logic (sync queue, notify) ...

    return list
  }

  /**
   * Add item to list (with quota protection)
   */
  async addItemToList(data: AddItemRequest): Promise<ListItem> {
    // ... validation and item creation ...

    const db = await this.initDB()

    // === WRAP WITH QUOTAGUARD ===
    await QuotaGuard.guardedWrite(
      () => db.put('lists', list),
      'addItemToList'
    )

    // ... rest of logic ...

    return newItem
  }

  /**
   * Update list (with quota protection)
   */
  async updateList(listId: string, updates: UpdateListRequest): Promise<UserList> {
    // ... validation and update logic ...

    const db = await this.initDB()

    // === WRAP WITH QUOTAGUARD ===
    await QuotaGuard.guardedWrite(
      () => db.put('lists', updatedList),
      'updateList'
    )

    // ... rest of logic ...

    return updatedList
  }

  /**
   * Import list (with quota protection)
   */
  async importList(data: ImportListRequest): Promise<UserList> {
    // ... parsing and validation ...

    const db = await this.initDB()

    // === WRAP WITH QUOTAGUARD ===
    await QuotaGuard.guardedWrite(
      () => db.put('lists', importedList),
      'importList'
    )

    // ... rest of logic ...

    return importedList
  }
}
```

### UI Error Handling

Update CRUD operations in pages to handle QuotaError:

```typescript
// /src/app/[locale]/lists/page.tsx

import { QuotaError } from '@/lib/storage/QuotaGuard'

const handleCreateList = async (data: CreateListRequest) => {
  try {
    const list = await listManager.createList(data)
    showToast(t('lists.success.created'), 'success')

  } catch (error) {
    // === HANDLE QUOTA ERROR ===
    if (error instanceof QuotaError) {
      showToast(
        `Storage full (${QuotaGuard.formatBytes(error.quotaStatus.usage)} used). Please free up space.`,
        'error'
      )
      // Optional: Open cleanup modal
    } else {
      showToast(t('lists.errors.createFailed'), 'error')
    }
  }
}
```

---

## Cleanup Suggestions

### Types of Cleanup

1. **Clear Sync Queue** (High Priority)
   - Target: Failed sync items (retryCount >= 3)
   - Target: Old sync items (>7 days in queue)
   - Impact: Frees ~5KB per item
   - Risk: Low (already failed, won't sync anyway)

2. **Delete Old Lists** (Medium Priority)
   - Target: Lists not updated in 90+ days
   - Impact: Frees ~2KB per item in list
   - Risk: Medium (user may want them, suggest export first)

3. **Export and Clear All** (Low Priority)
   - Target: All local data
   - Impact: Frees all IndexedDB storage
   - Risk: High (data loss if not exported properly)

### User Guidance

```typescript
const CLEANUP_GUIDANCE = {
  'clear-sync-queue': {
    title: 'Clear Failed Sync Items',
    description: 'These items failed to sync to the cloud and can be safely removed.',
    risk: 'low',
    action: 'Clean Up Now'
  },

  'delete-old-lists': {
    title: 'Delete Unused Lists',
    description: 'Lists you haven\'t updated in 90+ days. We recommend exporting them first.',
    risk: 'medium',
    action: 'Export & Delete'
  },

  'export-and-clear': {
    title: 'Clear All Local Data',
    description: 'Export all your lists and clear local storage. Use this as a last resort.',
    risk: 'high',
    action: 'Export First'
  }
}
```

---

## User Guidance

### Progressive Messaging

**At 90% Full**:
```
⚠️ Storage Running Low

You're using 45MB of 50MB (90% full).
Consider cleaning up old lists or failed sync items.

[View Cleanup Suggestions]
```

**At 95% Full**:
```
⚠️ Storage Almost Full

You're using 47.5MB of 50MB (95% full).
New items may fail to save. Please free up space now.

[View Cleanup Suggestions]
```

**At 98% Full**:
```
⚠️ STORAGE CRITICAL

You're using 49MB of 50MB (98% full).
Cannot save new items. You must free up space to continue.

[Free Up Space Now]
```

**On QuotaExceededError**:
```
❌ Storage Full

Cannot save changes. Your browser storage is full.

What you can do:
1. Delete old lists you no longer need
2. Clear failed sync items
3. Export lists and clear local storage
4. Upgrade to Premium for cloud storage

[View Cleanup Options]
```

### Help Center Article

Create help article at `/docs/storage-quota-help.md`:

```markdown
# Storage Quota Guide

## Understanding Browser Storage

Moshimoshi stores your lists locally in your browser using IndexedDB.
Each browser has limits on how much data apps can store:

- **Chrome/Edge**: Up to 60% of available disk space
- **Firefox**: Up to 50% of available disk space
- **Safari**: Up to 1GB total across all sites

## Free vs Premium Storage

- **Free Users**: Lists stored locally only (IndexedDB)
- **Premium Users**: Lists synced to cloud + local backup

## How to Free Up Space

### Option 1: Delete Old Lists
1. Go to My Lists
2. Tap ⋮ on lists you don't need
3. Select "Delete"

### Option 2: Clear Sync Queue
1. Look for "View Cleanup Suggestions" in storage warning
2. Tap "Clear failed sync items"
3. This removes items that failed to sync

### Option 3: Export and Clear
1. Export all lists (Settings → Export Data)
2. Verify export downloaded
3. Clear local storage (Settings → Clear Local Data)
4. Re-import lists if needed

## Preventing Storage Issues

- Regularly export your lists as backup
- Delete lists you no longer use
- Upgrade to Premium for unlimited cloud storage
```

---

## Testing Strategies

### Unit Tests

```typescript
// /src/lib/storage/__tests__/QuotaGuard.test.ts

describe('QuotaGuard', () => {
  describe('checkQuota', () => {
    it('should return quota status when API available', async () => {
      // Mock navigator.storage.estimate
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 45 * 1024 * 1024,   // 45MB
          quota: 50 * 1024 * 1024    // 50MB
        })
      }

      const status = await QuotaGuard.checkQuota()

      expect(status.percentage).toBeCloseTo(0.9, 2)
      expect(status.warning).toBe(true)
      expect(status.critical).toBe(false)
    })

    it('should mark as critical when >95% full', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 48 * 1024 * 1024,   // 48MB
          quota: 50 * 1024 * 1024    // 50MB
        })
      }

      const status = await QuotaGuard.checkQuota()

      expect(status.percentage).toBeCloseTo(0.96, 2)
      expect(status.critical).toBe(true)
      expect(status.available).toBe(false)
    })

    it('should gracefully handle missing Storage API', async () => {
      // @ts-ignore
      global.navigator.storage = undefined

      const status = await QuotaGuard.checkQuota()

      expect(status.available).toBe(true)  // Assume OK
      expect(status.percentage).toBe(0)
    })
  })

  describe('guardedWrite', () => {
    it('should execute operation when quota OK', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 50 * 1024 * 1024
        })
      }

      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await QuotaGuard.guardedWrite(
        mockOperation,
        'test-operation'
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
    })

    it('should throw QuotaError when quota exceeded pre-check', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 49 * 1024 * 1024,  // 98% full
          quota: 50 * 1024 * 1024
        })
      }

      const mockOperation = jest.fn()

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.toThrow(QuotaError)

      expect(mockOperation).not.toHaveBeenCalled()  // Blocked
    })

    it('should catch QuotaExceededError during operation', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 50 * 1024 * 1024
        })
      }

      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
      const mockOperation = jest.fn().mockRejectedValue(quotaError)

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.toThrow(QuotaError)
    })
  })

  describe('suggestCleanup', () => {
    it('should suggest clearing old sync queue items', async () => {
      // Mock IndexedDB with old sync items
      const mockDB = {
        getAll: jest.fn().mockResolvedValue([
          { id: '1', retryCount: 5, timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 },
          { id: '2', retryCount: 2, timestamp: Date.now() }
        ])
      }

      const suggestions = await QuotaGuard.suggestCleanup()

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].type).toBe('clear-sync-queue')
    })
  })

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(QuotaGuard.formatBytes(0)).toBe('0 Bytes')
      expect(QuotaGuard.formatBytes(1024)).toBe('1 KB')
      expect(QuotaGuard.formatBytes(1024 * 1024)).toBe('1 MB')
      expect(QuotaGuard.formatBytes(1536 * 1024)).toBe('1.5 MB')
    })
  })
})
```

### Integration Tests

```typescript
// /src/lib/lists/__tests__/ListManager.quota.test.ts

describe('ListManager with QuotaGuard', () => {
  it('should block list creation when quota exceeded', async () => {
    const manager = new ListManager()

    // Mock full quota
    global.navigator.storage = {
      estimate: jest.fn().mockResolvedValue({
        usage: 49 * 1024 * 1024,
        quota: 50 * 1024 * 1024
      })
    }

    await expect(
      manager.createList({ name: 'Test List', type: 'word' })
    ).rejects.toThrow(QuotaError)
  })

  it('should successfully create list when quota OK', async () => {
    const manager = new ListManager()

    global.navigator.storage = {
      estimate: jest.fn().mockResolvedValue({
        usage: 10 * 1024 * 1024,
        quota: 50 * 1024 * 1024
      })
    }

    const list = await manager.createList({ name: 'Test List', type: 'word' })

    expect(list).toBeDefined()
    expect(list.name).toBe('Test List')
  })
})
```

### Manual Testing

```
# Test Plan: Storage Quota Handling

## Setup
1. Open Chrome DevTools → Application → Storage
2. Right-click "IndexedDB" → "Clear"
3. Ensure user-lists DB starts empty

## Test Case 1: Normal Operation (Quota OK)
1. Create 10 lists with 50 items each
2. Verify no warnings shown
3. Verify StorageWarning component not visible

## Test Case 2: Warning Threshold (90%)
1. Fill storage to 45MB (if quota is 50MB)
2. Create new list
3. Verify yellow warning banner appears
4. Verify "View cleanup suggestions" button present

## Test Case 3: Critical Threshold (95%)
1. Fill storage to 47.5MB
2. Attempt to create new list
3. Verify operation blocked with QuotaError
4. Verify red critical banner appears
5. Verify cleanup suggestions displayed

## Test Case 4: Cleanup Actions
1. Trigger storage warning
2. Click "View cleanup suggestions"
3. Click "Clean Up" on first suggestion
4. Verify storage freed
5. Verify warning disappears when under threshold

## Test Case 5: Quota Exceeded During Write
1. Fill storage to 49.9MB
2. Attempt to import large list (2MB)
3. Verify QuotaExceededError caught
4. Verify toast shows "Storage full" message
5. Verify no data corruption

## Test Case 6: Graceful Degradation (Safari)
1. Test on Safari 14 (no Storage API)
2. Verify app still functions
3. Verify no quota checks performed
4. Verify no errors thrown
```

---

## Performance Considerations

### Quota Check Overhead

**Operation**: `navigator.storage.estimate()`
**Time**: 1-5ms (Chrome), 5-10ms (Firefox)
**Frequency**: Once per write operation

**Impact**: Minimal (<1% overhead)

### Optimization: Caching

```typescript
class QuotaGuard {
  private static cachedStatus: QuotaStatus | null = null
  private static cacheTime: number = 0
  private static readonly CACHE_TTL = 30000  // 30s

  static async checkQuota(): Promise<QuotaStatus> {
    const now = Date.now()

    // Return cached status if fresh
    if (this.cachedStatus && (now - this.cacheTime) < this.CACHE_TTL) {
      return this.cachedStatus
    }

    // Fetch fresh status
    const status = await this.checkQuotaInternal()

    // Cache result
    this.cachedStatus = status
    this.cacheTime = now

    return status
  }

  private static async checkQuotaInternal(): Promise<QuotaStatus> {
    // ... actual quota check logic ...
  }
}
```

**Benefit**: Reduces quota checks from 1 per operation to 1 per 30s

---

## Common Pitfalls

### Pitfall 1: Ignoring QuotaExceededError

**Problem**: Catching all errors generically loses quota context

**Solution**: Specifically handle QuotaError

```typescript
// WRONG
try {
  await listManager.createList(data)
} catch (error) {
  showToast('Failed to create list', 'error')  // No guidance
}

// RIGHT
try {
  await listManager.createList(data)
} catch (error) {
  if (error instanceof QuotaError) {
    showToast('Storage full. Please free up space.', 'error')
    // Show cleanup modal
  } else {
    showToast('Failed to create list', 'error')
  }
}
```

### Pitfall 2: False Positives in Development

**Problem**: DevTools "Clear storage on reload" interferes with quota

**Solution**: Disable during testing

### Pitfall 3: Not Testing Across Browsers

**Problem**: Safari has stricter quotas, different behavior

**Solution**: Test on Chrome, Firefox, Safari minimum

### Pitfall 4: Cleanup Without Export

**Problem**: User deletes data, then regrets it

**Solution**: Always offer export before destructive cleanup

```typescript
const handleClearAll = async () => {
  // 1. Show confirmation modal
  const confirmed = await showConfirmModal({
    title: 'Export before clearing?',
    message: 'We recommend exporting your lists first.',
    actions: [
      { label: 'Export First', action: 'export' },
      { label: 'Clear Anyway', action: 'clear', danger: true },
      { label: 'Cancel', action: 'cancel' }
    ]
  })

  if (confirmed === 'export') {
    await exportAllLists()
  }

  if (confirmed === 'clear') {
    await clearAllLocalData()
  }
}
```

---

## Next Steps

1. ✅ **Read This Document**: Understand quota management architecture
2. ➡️ **Create QuotaGuard Utility**: Follow IMPLEMENTATION_CHECKLIST.md Day 11
3. ➡️ **Wrap IndexedDB Writes**: Add QuotaGuard.guardedWrite() to all db.put() calls
4. ➡️ **Integrate StorageWarning**: Add component to list pages
5. ➡️ **Test Quota Scenarios**: Simulate full storage, verify graceful handling
6. ➡️ **Monitor Metrics**: Track QuotaError occurrences in production

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude (Sonnet 4.5)
**Status**: READY FOR IMPLEMENTATION
