jest.mock('firebase-admin/firestore', () => {
  class TimestampMock {
    seconds: number
    nanoseconds: number

    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds
      this.nanoseconds = nanoseconds
    }

    static now() {
      const ms = Date.now()
      return new TimestampMock(Math.floor(ms / 1000), (ms % 1000) * 1e6)
    }

    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1e6)
    }
  }

  return {
    Timestamp: TimestampMock,
    getFirestore: jest.fn()
  }
})

const mockStreakConfig = {
  version: '1.0.0',
  minXPForStreak: 25,
  gracePeriodHours: 24,
  resetTime: '00:00',
  timezone: 'UTC',
  streakFreeze: {
    enabled: true,
    requiresPremium: true,
    maxFreezes: 3,
    freezeDurationDays: 1,
    description: 'mock'
  },
  notifications: {
    enabled: true,
    reminderHours: [20, 22],
    description: 'mock'
  }
}

jest.mock('@/config/gamification/streakConfig', () => ({
  getStreakConfig: jest.fn(() => mockStreakConfig)
}))

import { Timestamp } from 'firebase-admin/firestore'

import {
  getCurrentDateUTC,
  parseISODate,
  calculateDaysDifference,
  isWithinGracePeriod,
  checkStreakEligibility,
  calculateNewStreakValues,
  updateStreakTransaction,
  updateStreakWithinTransaction,
  getStreakData,
  applyMergedStatsTransaction,
  useStreakFreeze
} from '../streakService'

const today = '2025-01-15'
const originalDateToISOString = Date.prototype.toISOString
beforeAll(() => {
  Date.prototype.toISOString = function toISOString() {
    return `${today}T12:00:00.000Z`
  }
})

afterAll(() => {
  Date.prototype.toISOString = originalDateToISOString
})

beforeEach(() => {
  mockStreakConfig.streakFreeze.enabled = true
  mockStreakConfig.streakFreeze.requiresPremium = true
  mockStreakConfig.streakFreeze.maxFreezes = 3
  mockStreakConfig.minXPForStreak = 25
  mockStreakConfig.gracePeriodHours = 24
})

describe('pure streak helpers', () => {
  test('getCurrentDateUTC returns yyyy-mm-dd', () => {
    expect(getCurrentDateUTC()).toBe(today)
  })

  test('parseISODate returns midnight UTC', () => {
    const result = parseISODate('2025-02-01')
    expect(result.getUTCFullYear()).toBe(2025)
    expect(result.getUTCMonth()).toBe(1)
    expect(result.getUTCDate()).toBe(1)
    expect(result.getUTCHours()).toBe(0)
  })

  test('calculateDaysDifference handles order agnostic', () => {
    expect(calculateDaysDifference('2025-02-01', '2025-02-03')).toBe(2)
    expect(calculateDaysDifference('2025-02-03', '2025-02-01')).toBe(2)
  })

  test('isWithinGracePeriod true when consecutive', () => {
    expect(isWithinGracePeriod('2025-02-01', '2025-02-02')).toBe(true)
    expect(isWithinGracePeriod('2025-02-01', '2025-02-04')).toBe(false)
  })

  describe('checkStreakEligibility', () => {
    it('rejects insufficient XP', () => {
      const result = checkStreakEligibility(10, null, 0, '2025-02-01', false)
      expect(result.shouldIncrement).toBe(false)
      expect(result.reason).toContain('Insufficient XP')
    })

    it('accepts first-time activity', () => {
      const result = checkStreakEligibility(30, null, 0, '2025-02-01', false)
      expect(result.shouldIncrement).toBe(true)
      expect(result.shouldReset).toBe(false)
    })

    it('uses freeze when enabled and within window', () => {
      const result = checkStreakEligibility(30, '2025-02-01', 1, '2025-02-03', true)
      expect(result.shouldIncrement).toBe(true)
      expect(result.reason).toBe('Freeze used')
    })
  })

  describe('calculateNewStreakValues', () => {
    it('increments streak and keeps best', () => {
      const eligibility = {
        shouldIncrement: true,
        shouldReset: false,
        isWithinGracePeriod: true,
        daysSinceLastActivity: 1,
        reason: 'Within grace period'
      }

      const result = calculateNewStreakValues(5, 10, 3, eligibility, {
        freezeEnabled: true,
        freezeUsed: false
      })

      expect(result.current).toBe(6)
      expect(result.best).toBe(10)
      expect(result.freezesRemaining).toBe(3)
    })

    it('resets streak and replenishes freezes when enabled', () => {
      const eligibility = {
        shouldIncrement: false,
        shouldReset: true,
        isWithinGracePeriod: false,
        daysSinceLastActivity: 3,
        reason: 'Missed'
      }

      const result = calculateNewStreakValues(7, 12, 0, eligibility, {
        freezeEnabled: true
      })

      expect(result.current).toBe(0)
      expect(result.best).toBe(12)
      expect(result.freezesRemaining).toBeGreaterThan(0)
    })
  })
})

// -----------------------------------------------------------------------------
// Firestore transaction helpers
// -----------------------------------------------------------------------------

const mockDocSnapshot = (data: any, exists = true) => ({
  exists,
  data: jest.fn(() => data)
})

const createMockFirestore = (initialData?: any) => {
  const docRef = {
    id: 'user_stats/test-user',
    get: jest.fn(async () => snapshot)
  }
  const snapshot = initialData ? mockDocSnapshot(initialData) : mockDocSnapshot(undefined, false)

  const transaction: any = {
    get: jest.fn(async () => snapshot),
    set: jest.fn(),
    update: jest.fn()
  }

  const firestore: any = {
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue(docRef)
    }),
    runTransaction: jest.fn(async (handler: any) => handler(transaction))
  }

  return { firestore, snapshot, transaction, docRef }
}

describe('updateStreakTransaction', () => {
  it('initializes streak for new user', async () => {
    const { firestore, transaction } = createMockFirestore()

    const result = await updateStreakTransaction('test-user', 40, {
      isPremium: false,
      db: firestore
    })

    expect(firestore.runTransaction).toHaveBeenCalledTimes(1)
    expect(transaction.set).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
    expect(result.data).not.toBeNull()
    expect(result.data?.current).toBe(1)
  })

  it('increments streak when eligible and matches version', async () => {
    const yesterday = '2025-01-14'
    const existing = {
      streak: {
        current: 5,
        best: 7,
        freezesRemaining: 0,
        version: 3,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: yesterday,
        isActiveToday: false
      }
    }
    const { firestore, transaction, snapshot } = createMockFirestore(existing)

    const result = await updateStreakTransaction('test-user', 40, {
      expectedVersion: 3,
      db: firestore
    })

    expect(result.success).toBe(true)
    expect(result.streakIncremented).toBe(true)
    expect(result.data?.current).toBe(6)
    expect(transaction.set).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        streak: expect.objectContaining({ current: 6, version: 4 })
      }),
      { merge: true }
    )
    expect(snapshot.data).toHaveBeenCalled()
  })

  it('returns conflict when version mismatch', async () => {
    const existing = {
      streak: {
        current: 2,
        best: 5,
        freezesRemaining: 0,
        version: 10,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: '2025-01-14',
        isActiveToday: false
      }
    }
    const { firestore } = createMockFirestore(existing)

    const result = await updateStreakTransaction('test-user', 40, {
      expectedVersion: 9,
      db: firestore
    })

    expect(result.success).toBe(false)
    expect(result.conflictDetected).toBe(true)
  })

  it('updates streak within existing transaction without extra reads', async () => {
    const yesterday = '2025-01-14'
    const existing = {
      streak: {
        current: 5,
        best: 7,
        freezesRemaining: 2,
        version: 3,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: yesterday,
        isActiveToday: false
      }
    }
    const { firestore, transaction, snapshot } = createMockFirestore(existing)

    transaction.get.mockClear()

    const result = await updateStreakWithinTransaction(transaction, 'test-user', 40, {
      isPremium: true,
      db: firestore,
      prefetchedDoc: snapshot
    })

    expect(transaction.get).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    expect(result.data?.current).toBe(6)
    expect(transaction.set).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        streak: expect.objectContaining({ current: 6, version: 4 })
      }),
      { merge: true }
    )
  })
})

describe('getStreakData', () => {
  it('returns null when doc missing', async () => {
    const { firestore } = createMockFirestore()
    const data = await getStreakData('user', firestore)
    expect(data).toBeNull()
  })
})

describe('applyMergedStatsTransaction', () => {
  it('merges streak using max strategy', async () => {
    const existing = {
      streak: {
        current: 3,
        best: 5,
        freezesRemaining: 0,
        version: 2,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: '2025-01-10',
        isActiveToday: false
      },
      xp: {
        total: 500,
        level: 2
      }
    }
    const { firestore, transaction } = createMockFirestore(existing)

    const incoming = {
      streak: { current: 4, best: 6 },
      dates: { lastActivityDate: '2025-01-12' },
      xp: { total: 550 }
    }

    const result = await applyMergedStatsTransaction('user', incoming, firestore)

    expect(result.success).toBe(true)
    expect(result.streakData?.current).toBe(4)
    expect(result.streakData?.best).toBe(6)
    expect(transaction.set).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        streak: expect.objectContaining({ current: 4, best: 6 }),
        xp: expect.objectContaining({ total: 550 })
      }),
      { merge: true }
    )
  })
})

describe('useStreakFreeze', () => {
  it('returns error when feature is disabled', async () => {
    mockStreakConfig.streakFreeze.enabled = false
    const result = await useStreakFreeze('user', true)
    expect(result.success).toBe(false)
    expect(result.error).toContain('disabled')
  })

  it('requires premium subscription when configured', async () => {
    const existing = {
      streak: {
        current: 4,
        best: 6,
        freezesRemaining: 1,
        version: 2,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: '2025-01-10',
        isActiveToday: false
      }
    }

    const { firestore } = createMockFirestore(existing)
    const result = await useStreakFreeze('user', false, firestore)
    expect(result.success).toBe(false)
    expect(result.error).toContain('premium')
  })

  it('decrements freeze count for premium users', async () => {
    const existing = {
      streak: {
        current: 4,
        best: 6,
        freezesRemaining: 2,
        version: 3,
        updatedAt: Timestamp.now()
      },
      dates: {
        lastActivityDate: '2025-01-10',
        isActiveToday: false
      }
    }

    const { firestore, transaction } = createMockFirestore(existing)
    const result = await useStreakFreeze('user', true, firestore)

    expect(result.success).toBe(true)
    expect(transaction.set).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        streak: expect.objectContaining({ freezesRemaining: 1 })
      }),
      { merge: true }
    )
  })
})
