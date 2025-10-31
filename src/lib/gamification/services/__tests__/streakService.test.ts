/**
 * Test Suite: Streak Service
 *
 * Tests all pure functions and business logic for the streak service.
 * Firebase transactions are tested with mocks.
 *
 * Coverage targets:
 * - Pure functions: 100%
 * - Business logic: 95%
 * - Firebase operations: 80%
 */

import {
  getCurrentDateUTC,
  parseISODate,
  calculateDaysDifference,
  isWithinGracePeriod,
  checkStreakEligibility,
  calculateNewStreakValues
} from '../streakService';

describe('streakService - Pure Functions', () => {
  describe('getCurrentDateUTC', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getCurrentDateUTC();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return UTC date, not local', () => {
      const result = getCurrentDateUTC();
      const expected = new Date().toISOString().split('T')[0];
      expect(result).toBe(expected);
    });
  });

  describe('parseISODate', () => {
    it('should parse ISO date string to Date at midnight UTC', () => {
      const result = parseISODate('2025-01-15');
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCMonth()).toBe(0); // January = 0
      expect(result.getUTCDate()).toBe(15);
      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
    });

    it('should handle different dates correctly', () => {
      const result = parseISODate('2024-12-31');
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(11); // December = 11
      expect(result.getUTCDate()).toBe(31);
    });
  });

  describe('calculateDaysDifference', () => {
    it('should return 0 for same date', () => {
      const result = calculateDaysDifference('2025-01-15', '2025-01-15');
      expect(result).toBe(0);
    });

    it('should return 1 for consecutive days', () => {
      const result = calculateDaysDifference('2025-01-15', '2025-01-16');
      expect(result).toBe(1);
    });

    it('should return 7 for week difference', () => {
      const result = calculateDaysDifference('2025-01-15', '2025-01-22');
      expect(result).toBe(7);
    });

    it('should work across month boundaries', () => {
      const result = calculateDaysDifference('2025-01-31', '2025-02-01');
      expect(result).toBe(1);
    });

    it('should work across year boundaries', () => {
      const result = calculateDaysDifference('2024-12-31', '2025-01-01');
      expect(result).toBe(1);
    });

    it('should handle reverse order (absolute difference)', () => {
      const result = calculateDaysDifference('2025-01-16', '2025-01-15');
      expect(result).toBe(1);
    });
  });

  describe('isWithinGracePeriod', () => {
    it('should return true for same day', () => {
      const result = isWithinGracePeriod('2025-01-15', '2025-01-15');
      expect(result).toBe(true);
    });

    it('should return true for consecutive days', () => {
      const result = isWithinGracePeriod('2025-01-15', '2025-01-16');
      expect(result).toBe(true);
    });

    it('should return false for 2+ day gap', () => {
      const result = isWithinGracePeriod('2025-01-15', '2025-01-17');
      expect(result).toBe(false);
    });

    it('should return false for week gap', () => {
      const result = isWithinGracePeriod('2025-01-15', '2025-01-22');
      expect(result).toBe(false);
    });
  });

  describe('checkStreakEligibility', () => {
    const MIN_XP = 25;

    it('should reject if XP is below minimum', () => {
      const result = checkStreakEligibility(20, '2025-01-15', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(false);
      expect(result.shouldReset).toBe(false);
      expect(result.reason).toContain('Insufficient XP');
    });

    it('should accept first-time activity', () => {
      const result = checkStreakEligibility(25, null, 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
      expect(result.reason).toBe('First-time activity');
    });

    it('should reject if already counted today', () => {
      const result = checkStreakEligibility(25, '2025-01-16', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(false);
      expect(result.shouldReset).toBe(false);
      expect(result.reason).toBe('Already counted today');
    });

    it('should increment for consecutive days', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
      expect(result.isWithinGracePeriod).toBe(true);
      expect(result.reason).toBe('Within grace period');
    });

    it('should reset if beyond grace period with no freezes', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 0, '2025-01-18');
      expect(result.shouldIncrement).toBe(false);
      expect(result.shouldReset).toBe(true);
      expect(result.isWithinGracePeriod).toBe(false);
      expect(result.daysSinceLastActivity).toBe(3);
    });

    it('should use freeze if available and within 2 days', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 1, '2025-01-17');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
      expect(result.isWithinGracePeriod).toBe(false);
      expect(result.reason).toBe('Freeze used');
    });

    it('should not use freeze if gap is too large', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 1, '2025-01-20');
      expect(result.shouldIncrement).toBe(false);
      expect(result.shouldReset).toBe(true);
      expect(result.daysSinceLastActivity).toBe(5);
    });

    it('should work across month boundaries', () => {
      const result = checkStreakEligibility(25, '2025-01-31', 0, '2025-02-01');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
      expect(result.isWithinGracePeriod).toBe(true);
    });

    it('should work across year boundaries', () => {
      const result = checkStreakEligibility(25, '2024-12-31', 0, '2025-01-01');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
      expect(result.isWithinGracePeriod).toBe(true);
    });
  });

  describe('calculateNewStreakValues', () => {
    it('should increment streak and update best streak', () => {
      const eligibility: StreakCheckResult = {
        shouldIncrement: true,
        shouldReset: false,
        isWithinGracePeriod: true,
        daysSinceLastActivity: 1,
        reason: 'Within grace period'
      };

      const result = calculateNewStreakValues(5, 10, eligibility, false);

      expect(result.currentStreak).toBe(6);
      expect(result.bestStreak).toBe(10); // Not updated since 6 < 10
      expect(result.newRecordSet).toBe(false);
    });

    it('should set new record when current exceeds best', () => {
      const eligibility: StreakCheckResult = {
        shouldIncrement: true,
        shouldReset: false,
        isWithinGracePeriod: true,
        daysSinceLastActivity: 1,
        reason: 'Within grace period'
      };

      const result = calculateNewStreakValues(10, 10, eligibility, false);

      expect(result.currentStreak).toBe(11);
      expect(result.bestStreak).toBe(11);
      expect(result.newRecordSet).toBe(true);
    });

    it('should reset streak to 0', () => {
      const eligibility: StreakCheckResult = {
        shouldIncrement: false,
        shouldReset: true,
        isWithinGracePeriod: false,
        daysSinceLastActivity: 3,
        reason: 'Missed days'
      };

      const result = calculateNewStreakValues(5, 10, eligibility, false);

      expect(result.currentStreak).toBe(0);
      expect(result.bestStreak).toBe(10); // Best streak never decreases
      expect(result.newRecordSet).toBe(false);
    });

    it('should not change streak if no action needed', () => {
      const eligibility: StreakCheckResult = {
        shouldIncrement: false,
        shouldReset: false,
        isWithinGracePeriod: true,
        daysSinceLastActivity: 0,
        reason: 'Already counted today'
      };

      const result = calculateNewStreakValues(5, 10, eligibility, false);

      expect(result.currentStreak).toBe(5);
      expect(result.bestStreak).toBe(10);
      expect(result.newRecordSet).toBe(false);
    });
  });
});

describe('streakService - Business Logic Edge Cases', () => {
  describe('Leap year handling', () => {
    it('should handle Feb 29 in leap year', () => {
      const result = checkStreakEligibility(25, '2024-02-28', 0, '2024-02-29');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
    });

    it('should handle Feb 28 -> Mar 1 in non-leap year', () => {
      const result = checkStreakEligibility(25, '2025-02-28', 0, '2025-03-01');
      expect(result.shouldIncrement).toBe(true);
      expect(result.shouldReset).toBe(false);
    });
  });

  describe('Timezone edge cases', () => {
    it('should use UTC consistently', () => {
      // Even if local time crosses day boundary, UTC should be consistent
      const date1 = '2025-01-15';
      const date2 = '2025-01-16';

      const parsed1 = parseISODate(date1);
      const parsed2 = parseISODate(date2);

      expect(parsed1.getUTCDate()).toBe(15);
      expect(parsed2.getUTCDate()).toBe(16);
    });
  });

  describe('XP threshold edge cases', () => {
    it('should accept exactly minimum XP', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(true);
    });

    it('should reject just below minimum XP', () => {
      const result = checkStreakEligibility(24, '2025-01-15', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(false);
      expect(result.reason).toContain('24/25');
    });

    it('should accept well above minimum XP', () => {
      const result = checkStreakEligibility(100, '2025-01-15', 0, '2025-01-16');
      expect(result.shouldIncrement).toBe(true);
    });
  });

  describe('Freeze edge cases', () => {
    it('should not use freeze if within grace period', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 3, '2025-01-16');
      expect(result.shouldIncrement).toBe(true);
      expect(result.reason).toBe('Within grace period'); // Not "Freeze used"
    });

    it('should use freeze for 2-day gap', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 1, '2025-01-17');
      expect(result.shouldIncrement).toBe(true);
      expect(result.reason).toBe('Freeze used');
    });

    it('should not use freeze if none remaining', () => {
      const result = checkStreakEligibility(25, '2025-01-15', 0, '2025-01-17');
      expect(result.shouldIncrement).toBe(false);
      expect(result.shouldReset).toBe(true);
    });
  });
});

describe('streakService - Integration Scenarios', () => {
  describe('New user journey', () => {
    it('should handle first activity correctly', () => {
      // Day 1: First activity
      const day1 = checkStreakEligibility(30, null, 0, '2025-01-01');
      expect(day1.shouldIncrement).toBe(true);

      const values1 = calculateNewStreakValues(0, 0, day1, false);
      expect(values1.currentStreak).toBe(1);
      expect(values1.bestStreak).toBe(1);

      // Day 2: Consecutive activity
      const day2 = checkStreakEligibility(30, '2025-01-01', 0, '2025-01-02');
      expect(day2.shouldIncrement).toBe(true);

      const values2 = calculateNewStreakValues(1, 1, day2, false);
      expect(values2.currentStreak).toBe(2);
      expect(values2.bestStreak).toBe(2);
    });
  });

  describe('Streak break and recovery', () => {
    it('should handle streak break and restart', () => {
      // Had 10-day streak
      const currentStreak = 10;
      const bestStreak = 10;

      // Missed 3 days
      const check = checkStreakEligibility(30, '2025-01-01', 0, '2025-01-04');
      expect(check.shouldReset).toBe(true);

      const values = calculateNewStreakValues(currentStreak, bestStreak, check, false);
      expect(values.currentStreak).toBe(0);
      expect(values.bestStreak).toBe(10); // Best streak preserved

      // New activity after break - starts from 1
      const newCheck = checkStreakEligibility(30, '2025-01-04', 0, '2025-01-05');
      expect(newCheck.shouldIncrement).toBe(true);

      const newValues = calculateNewStreakValues(0, 10, newCheck, false);
      expect(newValues.currentStreak).toBe(1);
      expect(newValues.bestStreak).toBe(10); // Still preserved
    });
  });

  describe('Record-breaking streak', () => {
    it('should track new records correctly', () => {
      const checks = [
        { current: 8, best: 10, expected: { current: 9, best: 10, newRecord: false } },
        { current: 9, best: 10, expected: { current: 10, best: 10, newRecord: false } },
        { current: 10, best: 10, expected: { current: 11, best: 11, newRecord: true } },
        { current: 11, best: 11, expected: { current: 12, best: 12, newRecord: true } },
      ];

      checks.forEach(({ current, best, expected }) => {
        const eligibility: StreakCheckResult = {
          shouldIncrement: true,
          shouldReset: false,
          isWithinGracePeriod: true,
          daysSinceLastActivity: 1,
          reason: 'Within grace period'
        };

        const result = calculateNewStreakValues(current, best, eligibility, false);

        expect(result.currentStreak).toBe(expected.current);
        expect(result.bestStreak).toBe(expected.best);
        expect(result.newRecordSet).toBe(expected.newRecord);
      });
    });
  });
});

describe('streakService - Firebase Transactions', () => {
  // Mock Firebase Admin
  let mockFirestore: any;
  let mockTransaction: any;
  let mockDocRef: any;
  let mockDocSnapshot: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock document snapshot
    mockDocSnapshot = {
      exists: true,
      data: jest.fn()
    };

    // Mock document reference
    mockDocRef = {
      get: jest.fn().mockResolvedValue(mockDocSnapshot),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined)
    };

    // Mock transaction
    mockTransaction = {
      get: jest.fn().mockResolvedValue(mockDocSnapshot),
      set: jest.fn(),
      update: jest.fn()
    };

    // Mock Firestore
    mockFirestore = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDocRef)
      }),
      runTransaction: jest.fn((callback) => callback(mockTransaction))
    };
  });

  describe('updateStreakTransaction', () => {
    const { updateStreakTransaction } = require('../streakService');

    it('should create initial streak data for new user', async () => {
      mockDocSnapshot.exists = false;

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.streakIncremented).toBe(true);
      expect(result.newRecordSet).toBe(true);
      expect(result.data).toMatchObject({
        currentStreak: 1,
        bestStreak: 1,
        totalXP: 30
      });
    });

    it('should increment streak for eligible activity', async () => {
      const yesterday = getCurrentDateUTC().split('-').map((n, i) => i === 2 ? parseInt(n) - 1 : parseInt(n)).join('-');

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: yesterday,
        totalXP: 1000,
        freezesRemaining: 2,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.streakIncremented).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('should not increment if already counted today', async () => {
      const today = getCurrentDateUTC();

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: today,
        totalXP: 1000,
        freezesRemaining: 2,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.streakIncremented).toBe(false);
    });

    it('should reset streak if beyond grace period', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: threeDaysAgoStr,
        totalXP: 1000,
        freezesRemaining: 0,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.data!.currentStreak).toBeLessThan(5);
    });

    it('should set new record when streak exceeds best', async () => {
      const yesterday = getCurrentDateUTC().split('-').map((n, i) => i === 2 ? parseInt(n) - 1 : parseInt(n)).join('-');

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 10,
        bestStreak: 10,
        lastActivityDate: yesterday,
        totalXP: 1000,
        freezesRemaining: 2,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.newRecordSet).toBe(true);
    });

    it('should handle transaction errors gracefully', async () => {
      mockFirestore.runTransaction.mockRejectedValue(new Error('Network error'));

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should reject insufficient XP', async () => {
      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: '2025-01-15',
        totalXP: 1000,
        freezesRemaining: 2,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 10, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.streakIncremented).toBe(false);
    });

    it('should use freeze when premium and within freeze window', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: twoDaysAgoStr,
        totalXP: 1000,
        freezesRemaining: 1,
        version: 1
      });

      const result = await updateStreakTransaction('testUser123', 30, true, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.streakIncremented).toBe(true);
    });

    it('should handle missing version field in existing data', async () => {
      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: getCurrentDateUTC(),
        totalXP: 1000,
        freezesRemaining: 2
        // version field missing (old data)
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
    });

    it('should handle missing freezesRemaining field', async () => {
      const yesterday = getCurrentDateUTC().split('-').map((n, i) => i === 2 ? parseInt(n) - 1 : parseInt(n)).join('-');

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: yesterday,
        totalXP: 1000,
        version: 1
        // freezesRemaining missing
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
    });

    it('should handle missing totalXP field', async () => {
      const yesterday = getCurrentDateUTC().split('-').map((n, i) => i === 2 ? parseInt(n) - 1 : parseInt(n)).join('-');

      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: yesterday,
        freezesRemaining: 2,
        version: 1
        // totalXP missing
      });

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(true);
      expect(result.data!.totalXP).toBe(30);
    });

    it('should handle conflict error (aborted transaction)', async () => {
      const error = new Error('Transaction aborted');
      (error as any).code = 'aborted';
      mockFirestore.runTransaction.mockRejectedValue(error);

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.conflictDetected).toBe(true);
    });

    it('should handle contention error', async () => {
      mockFirestore.runTransaction.mockRejectedValue(
        new Error('Transaction failed due to contention')
      );

      const result = await updateStreakTransaction('testUser123', 30, false, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.conflictDetected).toBe(true);
    });
  });

  describe('getStreakData', () => {
    const { getStreakData } = require('../streakService');

    it('should return streak data for existing user', async () => {
      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        lastActivityDate: '2025-01-15',
        totalXP: 1000,
        freezesRemaining: 2,
        version: 1
      });

      const result = await getStreakData('testUser123', mockFirestore);

      expect(result).not.toBeNull();
      expect(result!.currentStreak).toBe(5);
      expect(result!.bestStreak).toBe(10);
    });

    it('should return null for non-existent user', async () => {
      mockDocSnapshot.exists = false;

      const result = await getStreakData('nonExistentUser', mockFirestore);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockDocRef.get.mockRejectedValue(new Error('Database error'));

      const result = await getStreakData('testUser123', mockFirestore);

      expect(result).toBeNull();
    });
  });

  describe('resetStreak', () => {
    const { resetStreak } = require('../streakService');

    it('should reset streak successfully', async () => {
      mockDocSnapshot.data.mockReturnValue({
        currentStreak: 5,
        bestStreak: 10,
        version: 1
      });

      const result = await resetStreak('testUser123', mockFirestore);

      expect(result.success).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('should handle non-existent user', async () => {
      mockDocSnapshot.exists = false;

      const result = await resetStreak('testUser123', mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle transaction errors', async () => {
      mockFirestore.runTransaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await resetStreak('testUser123', mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction failed');
    });
  });

  describe('useStreakFreeze', () => {
    const { useStreakFreeze } = require('../streakService');

    it('should use freeze for premium user', async () => {
      mockDocSnapshot.data.mockReturnValue({
        freezesRemaining: 2,
        version: 1
      });

      const result = await useStreakFreeze('testUser123', true, mockFirestore);

      expect(result.success).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('should reject for non-premium user', async () => {
      const result = await useStreakFreeze('testUser123', false, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toContain('premium');
    });

    it('should reject when no freezes remaining', async () => {
      mockDocSnapshot.data.mockReturnValue({
        freezesRemaining: 0,
        version: 1
      });

      const result = await useStreakFreeze('testUser123', true, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No freezes');
    });

    it('should handle non-existent user', async () => {
      mockDocSnapshot.exists = false;

      const result = await useStreakFreeze('testUser123', true, mockFirestore);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
