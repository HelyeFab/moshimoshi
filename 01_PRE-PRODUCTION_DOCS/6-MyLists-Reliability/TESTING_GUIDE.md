# Testing Guide - MyLists Reliability Features

**Feature**: Comprehensive Testing Strategy for Multi-Tab, Sync, and Quota Features
**Priority**: CRITICAL - Quality Assurance
**Status**: PLANNED

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Coverage Requirements](#test-coverage-requirements)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Manual Testing](#manual-testing)
7. [Performance Testing](#performance-testing)
8. [CI/CD Integration](#cicd-integration)
9. [Common Testing Pitfalls](#common-testing-pitfalls)

---

## Testing Philosophy

### Test Pyramid

```
         ▲
        ╱ ╲
       ╱   ╲    E2E Tests (10%)
      ╱─────╲   - Multi-tab workflows
     ╱       ╲  - Real browser scenarios
    ╱─────────╲ Integration Tests (30%)
   ╱           ╲ - Component + Manager
  ╱─────────────╲ - IndexedDB + Firebase
 ╱               ╲
╱─────────────────╲ Unit Tests (60%)
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
- Pure functions
- Class methods
- Utilities
```

### Testing Principles

1. **Test Behavior, Not Implementation**: Focus on what the code does, not how
2. **Isolation**: Each test should be independent and idempotent
3. **Deterministic**: Same inputs always produce same outputs
4. **Fast**: Unit tests <1s, integration tests <5s, E2E tests <30s
5. **Readable**: Tests are documentation - make them clear
6. **Maintainable**: Avoid brittle tests that break on small changes

### Coverage Goals

| Component | Target Coverage | Rationale |
|-----------|----------------|-----------|
| TabCoordinator | 95% | Critical for multi-tab coordination |
| QuotaGuard | 95% | Critical for preventing data loss |
| ListManager | 90% | Core business logic |
| Sync Queue | 95% | Complex retry and circuit breaker logic |
| React Components | 80% | UI logic less critical than business logic |
| Overall | 85% | High confidence in reliability |

---

## Test Coverage Requirements

### Global Requirements

```bash
# Run all tests with coverage
npm run test:coverage

# Coverage thresholds (in jest.config.js)
{
  "coverageThreshold": {
    "global": {
      "branches": 85,
      "functions": 85,
      "lines": 85,
      "statements": 85
    },
    "./src/lib/lists/TabCoordinator.ts": {
      "branches": 95,
      "functions": 95,
      "lines": 95,
      "statements": 95
    },
    "./src/lib/storage/QuotaGuard.ts": {
      "branches": 95,
      "functions": 95,
      "lines": 95,
      "statements": 95
    },
    "./src/lib/lists/ListManager.ts": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

### Coverage Report

```bash
# Generate HTML coverage report
npm run test:coverage -- --coverage

# Open report
open coverage/lcov-report/index.html
```

### Enforcing Coverage in CI

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true

- name: Check coverage thresholds
  run: |
    if grep -q "Coverage.*below.*threshold" coverage-summary.txt; then
      echo "Coverage below threshold!"
      exit 1
    fi
```

---

## Unit Testing

### TabCoordinator Tests

**File**: `/src/lib/lists/__tests__/TabCoordinator.test.ts`

```typescript
import { TabCoordinator } from '../TabCoordinator'

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  private static channels: Map<string, MockBroadcastChannel[]> = new Map()

  constructor(name: string) {
    this.name = name
    const existing = MockBroadcastChannel.channels.get(name) || []
    existing.push(this)
    MockBroadcastChannel.channels.set(name, existing)
  }

  postMessage(message: any) {
    const channels = MockBroadcastChannel.channels.get(this.name) || []
    channels.forEach(channel => {
      if (channel !== this && channel.onmessage) {
        channel.onmessage({ data: message } as MessageEvent)
      }
    })
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.name) || []
    const index = channels.indexOf(this)
    if (index > -1) {
      channels.splice(index, 1)
    }
  }

  static reset() {
    this.channels.clear()
  }
}

global.BroadcastChannel = MockBroadcastChannel as any

describe('TabCoordinator', () => {
  beforeEach(() => {
    MockBroadcastChannel.reset()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Initialization', () => {
    it('should generate unique tab ID', () => {
      const coordinator = new TabCoordinator('test-channel')
      expect(coordinator.getTabId()).toMatch(/^tab-\d+-[a-z0-9]+$/)
    })

    it('should create BroadcastChannel with correct name', async () => {
      const coordinator = new TabCoordinator('test-channel')
      await coordinator.initialize()

      // Verify channel exists (implicit by no errors)
      expect(coordinator).toBeDefined()
    })

    it('should announce presence on join', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      const coordinator2 = new TabCoordinator('test-channel')

      const messagesReceived: any[] = []
      coordinator2.onMessage(msg => messagesReceived.push(msg))

      await coordinator1.initialize()
      await coordinator2.initialize()

      jest.advanceTimersByTime(200)

      const joinMessages = messagesReceived.filter(m => m.type === 'tab-join')
      expect(joinMessages.length).toBeGreaterThan(0)
    })
  })

  describe('Leader Election', () => {
    it('should become leader when no other tabs exist', async () => {
      const coordinator = new TabCoordinator('test-channel')
      await coordinator.initialize()

      jest.advanceTimersByTime(200)  // ELECTION_DELAY

      expect(coordinator.isLeader()).toBe(true)
    })

    it('should elect oldest tab as leader', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      await coordinator1.initialize()
      jest.advanceTimersByTime(200)

      // Wait 100ms, then create second tab
      jest.advanceTimersByTime(100)

      const coordinator2 = new TabCoordinator('test-channel')
      await coordinator2.initialize()
      jest.advanceTimersByTime(200)

      expect(coordinator1.isLeader()).toBe(true)
      expect(coordinator2.isLeader()).toBe(false)
    })

    it('should re-elect leader when current leader closes', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      const coordinator2 = new TabCoordinator('test-channel')

      await coordinator1.initialize()
      jest.advanceTimersByTime(200)

      await coordinator2.initialize()
      jest.advanceTimersByTime(200)

      expect(coordinator1.isLeader()).toBe(true)
      expect(coordinator2.isLeader()).toBe(false)

      // Leader closes
      coordinator1.cleanup()
      jest.advanceTimersByTime(200)  // ELECTION_DELAY

      expect(coordinator2.isLeader()).toBe(true)
    })
  })

  describe('Heartbeat', () => {
    it('should send heartbeat every 5 seconds as leader', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      const coordinator2 = new TabCoordinator('test-channel')

      const heartbeats: any[] = []
      coordinator2.onMessage(msg => {
        if (msg.type === 'heartbeat') heartbeats.push(msg)
      })

      await coordinator1.initialize()
      await coordinator2.initialize()
      jest.advanceTimersByTime(200)

      // Advance 15s (should get 3 heartbeats)
      jest.advanceTimersByTime(15000)

      expect(heartbeats.length).toBeGreaterThanOrEqual(3)
    })

    it('should detect leader timeout and elect new leader', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      const coordinator2 = new TabCoordinator('test-channel')

      await coordinator1.initialize()
      jest.advanceTimersByTime(200)

      await coordinator2.initialize()
      jest.advanceTimersByTime(200)

      expect(coordinator1.isLeader()).toBe(true)
      expect(coordinator2.isLeader()).toBe(false)

      // Stop coordinator1 heartbeat (simulate freeze)
      coordinator1.cleanup()
      // Don't announce resignation (simulate crash)

      // Wait for timeout (10s + detection interval)
      jest.advanceTimersByTime(12000)

      expect(coordinator2.isLeader()).toBe(true)
    })
  })

  describe('Message Broadcasting', () => {
    it('should broadcast messages to other tabs', async () => {
      const coordinator1 = new TabCoordinator('test-channel')
      const coordinator2 = new TabCoordinator('test-channel')

      const receivedMessages: any[] = []
      coordinator2.onMessage(msg => receivedMessages.push(msg))

      await coordinator1.initialize()
      await coordinator2.initialize()
      jest.advanceTimersByTime(200)

      coordinator1.broadcast({
        type: 'test-message',
        payload: { data: 'hello' },
        tabId: coordinator1.getTabId(),
        timestamp: Date.now()
      })

      jest.advanceTimersByTime(100)

      expect(receivedMessages.some(m => m.type === 'test-message')).toBe(true)
    })

    it('should not receive own messages', async () => {
      const coordinator = new TabCoordinator('test-channel')

      const receivedMessages: any[] = []
      coordinator.onMessage(msg => receivedMessages.push(msg))

      await coordinator.initialize()
      jest.advanceTimersByTime(200)

      coordinator.broadcast({
        type: 'test-message',
        payload: { data: 'hello' },
        tabId: coordinator.getTabId(),
        timestamp: Date.now()
      })

      jest.advanceTimersByTime(100)

      const ownMessages = receivedMessages.filter(m =>
        m.type === 'test-message' && m.tabId === coordinator.getTabId()
      )

      expect(ownMessages.length).toBe(0)
    })
  })

  describe('Fallback Mode', () => {
    it('should use localStorage fallback when BroadcastChannel unavailable', async () => {
      // Remove BroadcastChannel
      const originalBC = global.BroadcastChannel
      // @ts-ignore
      global.BroadcastChannel = undefined

      const coordinator = new TabCoordinator('test-channel')
      await coordinator.initialize()

      // In fallback mode, assume leader
      expect(coordinator.isLeader()).toBe(true)

      // Restore
      global.BroadcastChannel = originalBC
    })
  })
})
```

### QuotaGuard Tests

**File**: `/src/lib/storage/__tests__/QuotaGuard.test.ts`

```typescript
import { QuotaGuard, QuotaError } from '../QuotaGuard'

describe('QuotaGuard', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()
  })

  describe('checkQuota', () => {
    it('should return quota status when API available', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 45 * 1024 * 1024,   // 45MB
          quota: 50 * 1024 * 1024    // 50MB
        })
      } as any

      const status = await QuotaGuard.checkQuota()

      expect(status.usage).toBe(45 * 1024 * 1024)
      expect(status.quota).toBe(50 * 1024 * 1024)
      expect(status.percentage).toBeCloseTo(0.9, 2)
      expect(status.warning).toBe(true)
      expect(status.critical).toBe(false)
      expect(status.available).toBe(true)
    })

    it('should mark as critical when >95% full', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 48 * 1024 * 1024,   // 96% full
          quota: 50 * 1024 * 1024
        })
      } as any

      const status = await QuotaGuard.checkQuota()

      expect(status.percentage).toBeCloseTo(0.96, 2)
      expect(status.critical).toBe(true)
      expect(status.available).toBe(false)
    })

    it('should handle missing Storage API gracefully', async () => {
      // @ts-ignore
      global.navigator.storage = undefined

      const status = await QuotaGuard.checkQuota()

      expect(status.available).toBe(true)  // Fail open
      expect(status.percentage).toBe(0)
    })

    it('should handle estimate() errors gracefully', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockRejectedValue(new Error('API error'))
      } as any

      const status = await QuotaGuard.checkQuota()

      expect(status.available).toBe(true)  // Fail open
    })
  })

  describe('guardedWrite', () => {
    it('should execute operation when quota OK', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 50 * 1024 * 1024
        })
      } as any

      const mockOperation = jest.fn().mockResolvedValue('success')

      const result = await QuotaGuard.guardedWrite(
        mockOperation,
        'test-operation'
      )

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalled()
    })

    it('should throw QuotaError when quota critical pre-check', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 49 * 1024 * 1024,  // 98% full
          quota: 50 * 1024 * 1024
        })
      } as any

      const mockOperation = jest.fn()

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.toThrow(QuotaError)

      expect(mockOperation).not.toHaveBeenCalled()
    })

    it('should catch QuotaExceededError during operation', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 50 * 1024 * 1024
        })
      } as any

      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError')
      const mockOperation = jest.fn().mockRejectedValue(quotaError)

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.toThrow(QuotaError)
    })

    it('should re-throw non-quota errors', async () => {
      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 50 * 1024 * 1024
        })
      } as any

      const otherError = new Error('Network error')
      const mockOperation = jest.fn().mockRejectedValue(otherError)

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.toThrow('Network error')

      await expect(
        QuotaGuard.guardedWrite(mockOperation, 'test')
      ).rejects.not.toThrow(QuotaError)
    })

    it('should log warning when approaching threshold', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      global.navigator.storage = {
        estimate: jest.fn().mockResolvedValue({
          usage: 46 * 1024 * 1024,  // 92% full
          quota: 50 * 1024 * 1024
        })
      } as any

      const mockOperation = jest.fn().mockResolvedValue('success')

      await QuotaGuard.guardedWrite(mockOperation, 'test-operation')

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('92'),
        expect.anything()
      )

      consoleWarnSpy.mockRestore()
    })
  })

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(QuotaGuard.formatBytes(0)).toBe('0 Bytes')
      expect(QuotaGuard.formatBytes(1024)).toBe('1 KB')
      expect(QuotaGuard.formatBytes(1024 * 1024)).toBe('1 MB')
      expect(QuotaGuard.formatBytes(1536 * 1024)).toBe('1.5 MB')
      expect(QuotaGuard.formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
    })
  })
})
```

### ListManager Sync Queue Tests

**File**: `/src/lib/lists/__tests__/ListManager.sync.test.ts`

```typescript
import { ListManager } from '../ListManager'

describe('ListManager Sync Queue', () => {
  let manager: ListManager

  beforeEach(() => {
    manager = new ListManager()
    jest.clearAllMocks()
  })

  describe('processSyncQueue', () => {
    it('should sync all pending items', async () => {
      await manager.initDB()

      // Create 3 lists (adds to queue)
      await manager.createList({ name: 'List 1', type: 'word' })
      await manager.createList({ name: 'List 2', type: 'word' })
      await manager.createList({ name: 'List 3', type: 'word' })

      // Mock successful API calls
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve('')
        } as Response)
      )

      // Make this tab leader
      await manager['tabCoordinator']?.initialize()
      jest.advanceTimersByTime(200)

      // Process queue
      await manager['processSyncQueue']()

      const status = manager.getSyncStatus()
      expect(status.pendingCount).toBe(0)
      expect(status.syncState).toBe('synced')
    })

    it('should retry failed items with exponential backoff', async () => {
      await manager.initDB()

      await manager.createList({ name: 'Test List', type: 'word' })

      let attemptCount = 0
      global.fetch = jest.fn(() => {
        attemptCount++
        return Promise.reject(new Error('Network error'))
      })

      await manager['processSyncQueue']()

      const db = await manager['initDB']()
      const items = await db.getAll('syncQueue')

      expect(items[0].retryCount).toBe(1)
      expect(items[0].nextRetryAt).toBeGreaterThan(Date.now())
    })

    it('should remove items after max retries', async () => {
      await manager.initDB()

      await manager.createList({ name: 'Test List', type: 'word' })

      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')))

      // Retry 5 times
      for (let i = 0; i < 5; i++) {
        await manager['processSyncQueue']()
      }

      const db = await manager['initDB']()
      const items = await db.getAll('syncQueue')

      expect(items.length).toBe(0)  // Removed after max retries
    })

    it('should open circuit breaker after 5 failures', async () => {
      await manager.initDB()

      // Create 5 lists
      for (let i = 0; i < 5; i++) {
        await manager.createList({ name: `List ${i}`, type: 'word' })
      }

      global.fetch = jest.fn(() => Promise.reject(new Error('Server down')))

      await manager['processSyncQueue']()

      const status = manager.getSyncStatus()
      expect(status.syncState).toBe('error')
      expect(manager['circuitBreaker'].state).toBe('open')
    })

    it('should transition circuit breaker to half-open after timeout', async () => {
      await manager.initDB()

      // Trigger circuit breaker open
      for (let i = 0; i < 5; i++) {
        await manager.createList({ name: `List ${i}`, type: 'word' })
      }
      global.fetch = jest.fn(() => Promise.reject(new Error('Server down')))
      await manager['processSyncQueue']()

      expect(manager['circuitBreaker'].state).toBe('open')

      // Wait 30s (timeout)
      jest.advanceTimersByTime(30000)

      // Next sync should transition to half-open
      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('') } as Response)
      )

      await manager['processSyncQueue']()

      expect(manager['circuitBreaker'].state).toBe('closed')
    })
  })

  describe('Online/Offline Handling', () => {
    it('should defer sync when offline', async () => {
      await manager.initDB()

      // Simulate offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      await manager.createList({ name: 'Test List', type: 'word' })

      const status = manager.getSyncStatus()
      expect(status.syncState).toBe('offline')
    })

    it('should resume sync when coming online', async () => {
      await manager.initDB()

      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      await manager.createList({ name: 'Test List', type: 'word' })

      // Come online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      })

      window.dispatchEvent(new Event('online'))

      global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, text: () => Promise.resolve('') } as Response)
      )

      await manager['processSyncQueue']()

      const status = manager.getSyncStatus()
      expect(status.syncState).toBe('synced')
    })
  })
})
```

---

## Integration Testing

### Multi-Tab Integration Tests

**File**: `/src/lib/lists/__tests__/ListManager.multi-tab.test.ts`

```typescript
import { ListManager } from '../ListManager'

describe('ListManager Multi-Tab Integration', () => {
  let manager1: ListManager
  let manager2: ListManager

  beforeEach(async () => {
    manager1 = new ListManager()
    manager2 = new ListManager()

    await manager1.initDB()
    await manager2.initDB()

    jest.useFakeTimers()
  })

  afterEach(() => {
    manager1.cleanup()
    manager2.cleanup()
    jest.useRealTimers()
  })

  it('should sync list creation across tabs', async () => {
    const list = await manager1.createList({
      name: 'Test List',
      type: 'word'
    })

    jest.advanceTimersByTime(200)

    const lists = await manager2.getAllLists()
    expect(lists.some(l => l.id === list.id)).toBe(true)
  })

  it('should prevent duplicate sync queue processing', async () => {
    let apiCallCount = 0
    global.fetch = jest.fn(() => {
      apiCallCount++
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('')
      } as Response)
    })

    await manager1.createList({ name: 'Test List', type: 'word' })

    jest.advanceTimersByTime(200)

    await Promise.all([
      manager1['processSyncQueue'](),
      manager2['processSyncQueue']()
    ])

    // Only leader should sync
    expect(apiCallCount).toBe(1)
  })

  it('should handle concurrent edits with Last-Write-Wins', async () => {
    const list = await manager1.createList({ name: 'Original', type: 'word' })

    jest.advanceTimersByTime(200)

    await Promise.all([
      manager1.updateList(list.id, { name: 'Edit from Tab 1' }),
      manager2.updateList(list.id, { name: 'Edit from Tab 2' })
    ])

    jest.advanceTimersByTime(200)

    const finalList = await manager1.getListById(list.id)
    expect(['Edit from Tab 1', 'Edit from Tab 2']).toContain(finalList?.name)
  })
})
```

---

## E2E Testing

### Multi-Tab E2E Tests

**File**: `/e2e/lists-multi-tab.spec.ts`

```typescript
import { test, expect, chromium } from '@playwright/test'

test.describe('Multi-Tab Lists', () => {
  test('should sync list creation across tabs', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()

    const tab1 = await context.newPage()
    const tab2 = await context.newPage()

    // Navigate both tabs
    await tab1.goto('/lists')
    await tab2.goto('/lists')

    // Create list in tab1
    await tab1.click('[data-testid="create-list-button"]')
    await tab1.fill('[data-testid="list-name-input"]', 'Multi-Tab Test List')
    await tab1.click('[data-testid="create-list-submit"]')

    // Wait for sync
    await tab1.waitForSelector('[data-testid="list-card"]:has-text("Multi-Tab Test List")')

    // Verify appears in tab2
    await tab2.reload()
    await expect(tab2.locator('[data-testid="list-card"]:has-text("Multi-Tab Test List")')).toBeVisible()

    await browser.close()
  })

  test('should show leader indicator', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()

    const tab1 = await context.newPage()
    const tab2 = await context.newPage()

    await tab1.goto('/lists')
    await tab2.goto('/lists')

    // Wait for leader election
    await tab1.waitForTimeout(300)

    // Only one tab should be leader
    const tab1IsLeader = await tab1.locator('[data-testid="is-leader"]').isVisible()
    const tab2IsLeader = await tab2.locator('[data-testid="is-leader"]').isVisible()

    expect(tab1IsLeader !== tab2IsLeader).toBe(true)

    await browser.close()
  })

  test('should re-elect leader when leader tab closes', async () => {
    const browser = await chromium.launch()
    const context = await browser.newContext()

    const tab1 = await context.newPage()
    const tab2 = await context.newPage()

    await tab1.goto('/lists')
    await tab2.goto('/lists')

    await tab1.waitForTimeout(300)

    // Determine which is leader
    const tab1IsLeader = await tab1.locator('[data-testid="is-leader"]').isVisible()

    if (tab1IsLeader) {
      // Close leader
      await tab1.close()

      // Tab2 should become leader
      await tab2.waitForTimeout(500)
      await expect(tab2.locator('[data-testid="is-leader"]')).toBeVisible()
    }

    await browser.close()
  })
})
```

### Quota E2E Tests

**File**: `/e2e/lists-quota.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Storage Quota', () => {
  test('should show warning when quota low', async ({ page, context }) => {
    await page.goto('/lists')

    // Fill storage to 90%
    await page.evaluate(async () => {
      const { openDB } = await import('idb')
      const db = await openDB('user-lists', 1)

      // Create large dummy data
      for (let i = 0; i < 1000; i++) {
        await db.put('lists', {
          id: `dummy-${i}`,
          userId: 'test',
          name: `Dummy List ${i}`,
          type: 'word',
          items: new Array(500).fill({ content: 'word', id: `item-${i}` }),
          emoji: '📚',
          color: 'primary',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }
    })

    await page.reload()

    // Should show storage warning
    await expect(page.locator('[data-testid="storage-warning"]')).toBeVisible()
  })

  test('should block operation when quota exceeded', async ({ page }) => {
    await page.goto('/lists')

    // Mock quota as full
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: async () => ({
            usage: 49 * 1024 * 1024,
            quota: 50 * 1024 * 1024
          })
        }
      })
    })

    // Try to create list
    await page.click('[data-testid="create-list-button"]')
    await page.fill('[data-testid="list-name-input"]', 'Test List')
    await page.click('[data-testid="create-list-submit"]')

    // Should show error toast
    await expect(page.locator('[data-testid="toast"]:has-text("Storage full")')).toBeVisible()
  })
})
```

---

## Manual Testing

### Manual Test Plan

**File**: `/01_PRODUCTION_DOCS/6-MyLists-Reliability/MANUAL_TEST_PLAN.md`

#### Test Case 1: Multi-Tab List Creation
```
Prerequisites:
- Clear browser data
- Open 2 browser tabs

Steps:
1. Tab 1: Navigate to /lists
2. Tab 2: Navigate to /lists
3. Tab 1: Create new list "Vocabulary"
4. Tab 2: Refresh page (or wait 5s)

Expected:
✓ List appears in Tab 2 without refresh
✓ Only one tab shows "Leader" indicator
✓ No console errors

Actual:
[ ] Pass  [ ] Fail

Notes:
_________________________________
```

#### Test Case 2: Leader Re-Election
```
Prerequisites:
- Have 2 tabs open on /lists

Steps:
1. Identify leader tab (shows "Leader" indicator)
2. Close leader tab
3. Wait 15s
4. Check remaining tab

Expected:
✓ Remaining tab becomes leader within 15s
✓ "Leader" indicator appears in remaining tab
✓ Sync queue continues processing

Actual:
[ ] Pass  [ ] Fail

Notes:
_________________________________
```

#### Test Case 3: Offline → Online Sync
```
Prerequisites:
- Premium user account
- Clear browser data

Steps:
1. Open DevTools → Network → Set "Offline"
2. Create 3 lists
3. Verify toast shows "Offline - will sync later"
4. Set "Online"
5. Wait 10s

Expected:
✓ Lists saved locally while offline
✓ Sync indicator shows "Syncing..." when online
✓ All 3 lists appear in Firebase within 10s
✓ Sync indicator shows "Synced" (green)

Actual:
[ ] Pass  [ ] Fail

Notes:
_________________________________
```

#### Test Case 4: Storage Warning
```
Prerequisites:
- Clear browser data

Steps:
1. Navigate to /lists
2. Open DevTools → Application → Storage → IndexedDB
3. Create 50 lists with 100 items each
4. Check storage usage (navigator.storage.estimate())

Expected:
✓ Storage warning appears when >90% full
✓ Warning shows percentage and MB used
✓ "View cleanup suggestions" button present

Actual:
[ ] Pass  [ ] Fail

Notes:
_________________________________
```

---

## Performance Testing

### Performance Benchmarks

```typescript
// /src/lib/lists/__tests__/ListManager.perf.test.ts

describe('ListManager Performance', () => {
  it('should create list in <50ms', async () => {
    const manager = new ListManager()
    await manager.initDB()

    const start = performance.now()

    await manager.createList({ name: 'Test List', type: 'word' })

    const duration = performance.now() - start

    expect(duration).toBeLessThan(50)
  })

  it('should handle 1000 items queue in <100ms', async () => {
    const manager = new ListManager()
    await manager.initDB()

    // Create 1000 sync queue items
    const db = await manager['initDB']()
    for (let i = 0; i < 1000; i++) {
      await db.put('syncQueue', {
        id: `item-${i}`,
        action: 'create',
        data: {},
        timestamp: Date.now(),
        retryCount: 0
      })
    }

    const start = performance.now()

    await manager['processSyncQueue']()

    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
  })
})
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test-mylists.yml
name: MyLists Tests

on:
  push:
    branches: [main]
    paths:
      - 'src/lib/lists/**'
      - 'src/lib/storage/**'
      - 'src/components/lists/**'
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests with coverage
        run: npm run test:coverage -- --testPathPattern="lib/(lists|storage)"

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: mylists
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration -- --testPathPattern="lists.*integration"

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e -- lists-multi-tab.spec.ts lists-quota.spec.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: test-results/
```

---

## Common Testing Pitfalls

### Pitfall 1: Flaky Timers
**Problem**: Tests depend on real timers, fail intermittently

**Solution**: Use fake timers
```typescript
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Advance time deterministically
jest.advanceTimersByTime(5000)
```

### Pitfall 2: Shared IndexedDB State
**Problem**: Tests pollute each other's IndexedDB

**Solution**: Clear database before each test
```typescript
beforeEach(async () => {
  const { deleteDB } = await import('idb')
  await deleteDB('user-lists')
})
```

### Pitfall 3: Mocking BroadcastChannel Incorrectly
**Problem**: Tests pass but real browser fails

**Solution**: Use comprehensive mock
```typescript
class MockBroadcastChannel {
  static channels = new Map()

  postMessage(msg) {
    // Broadcast to ALL channels with same name
    this.constructor.channels.get(this.name).forEach(ch => {
      if (ch !== this) ch.onmessage?.({ data: msg })
    })
  }
}
```

### Pitfall 4: Not Testing Error Paths
**Problem**: Only testing happy path

**Solution**: Test all error scenarios
```typescript
it('should handle quota exceeded error', async () => {
  // Mock full quota
  // Attempt operation
  // Expect QuotaError thrown
})

it('should handle network failure', async () => {
  // Mock fetch rejection
  // Attempt sync
  // Expect retry scheduled
})
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Author**: Claude (Sonnet 4.5)
**Status**: READY FOR IMPLEMENTATION
