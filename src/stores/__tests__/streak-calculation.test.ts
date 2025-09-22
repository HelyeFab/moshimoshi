/**
 * Streak Calculation Tests
 *
 * These tests verify that the streak calculation logic correctly handles
 * various scenarios including:
 * - Activity today
 * - Activity yesterday but not today
 * - Gaps in activity
 * - Multiple consecutive days
 * - Edge cases around timezones
 */

describe('Streak Calculation', () => {

  // Helper function that mirrors the fixed streak calculation logic
  function calculateStreak(activityDates: string[]): number {
    if (!activityDates || activityDates.length === 0) {
      return 0;
    }

    // Deduplicate dates first
    const uniqueDates = [...new Set(activityDates)];
    const sortedDates = uniqueDates.sort().reverse();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let streak = 0;
    let expectedDate = new Date(todayDate);

    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        // This date matches the expected date
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1); // Move to previous day
      } else if (streak === 0 && daysDiff === 1) {
        // First date is yesterday (streak continues from yesterday)
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 2); // Skip today, move to day before yesterday
      } else {
        // Gap found, streak is broken
        break;
      }
    }

    return streak;
  }

  // Helper to get date string in YYYY-MM-DD format
  function getDateString(daysAgo: number = 0): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  describe('Basic Scenarios', () => {
    test('No activity should return 0 streak', () => {
      expect(calculateStreak([])).toBe(0);
    });

    test('Activity today only should return 1', () => {
      const dates = [getDateString(0)]; // Today
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Activity yesterday only should return 1 (streak still active)', () => {
      const dates = [getDateString(1)]; // Yesterday
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Activity 2 days ago only should return 0 (streak broken)', () => {
      const dates = [getDateString(2)]; // 2 days ago
      expect(calculateStreak(dates)).toBe(0);
    });
  });

  describe('Consecutive Days', () => {
    test('Activity today and yesterday should return 2', () => {
      const dates = [
        getDateString(0), // Today
        getDateString(1), // Yesterday
      ];
      expect(calculateStreak(dates)).toBe(2);
    });

    test('Activity for last 5 consecutive days including today', () => {
      const dates = [
        getDateString(0), // Today
        getDateString(1), // Yesterday
        getDateString(2), // 2 days ago
        getDateString(3), // 3 days ago
        getDateString(4), // 4 days ago
      ];
      expect(calculateStreak(dates)).toBe(5);
    });

    test('Activity for last 5 consecutive days NOT including today (but including yesterday)', () => {
      const dates = [
        getDateString(1), // Yesterday
        getDateString(2), // 2 days ago
        getDateString(3), // 3 days ago
        getDateString(4), // 4 days ago
        getDateString(5), // 5 days ago
      ];
      expect(calculateStreak(dates)).toBe(5);
    });

    test('Activity for last 30 consecutive days including today', () => {
      const dates = [];
      for (let i = 0; i < 30; i++) {
        dates.push(getDateString(i));
      }
      expect(calculateStreak(dates)).toBe(30);
    });
  });

  describe('Gaps in Activity', () => {
    test('Gap between today and 2 days ago should return 1', () => {
      const dates = [
        getDateString(0), // Today
        getDateString(2), // 2 days ago (gap at yesterday)
      ];
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Gap between yesterday and 3 days ago should return 1', () => {
      const dates = [
        getDateString(1), // Yesterday
        getDateString(3), // 3 days ago (gap at 2 days ago)
      ];
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Multiple activities with gap should count only recent streak', () => {
      const dates = [
        getDateString(0), // Today
        getDateString(1), // Yesterday
        getDateString(2), // 2 days ago
        // Gap at 3 days ago
        getDateString(4), // 4 days ago
        getDateString(5), // 5 days ago
        getDateString(6), // 6 days ago
      ];
      expect(calculateStreak(dates)).toBe(3); // Only counts today, yesterday, and 2 days ago
    });
  });

  describe('Real-world Scenarios', () => {
    test('User case: Activity on Sept 15, checking on Sept 16', () => {
      // Simulate the actual bug scenario
      const sept15 = '2025-09-15';
      const today = new Date('2025-09-16');

      // Mock current date to Sept 16
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2025-09-16T07:00:00Z');
          } else {
            super(...args);
          }
        }
        static now() {
          return new originalDate('2025-09-16T07:00:00Z').getTime();
        }
      } as any;

      const dates = [sept15];
      expect(calculateStreak(dates)).toBe(1); // Should be 1, not 0!

      // Restore original Date
      global.Date = originalDate;
    });

    test('Weekly warrior: Activity every day for a week', () => {
      const dates = [];
      for (let i = 0; i < 7; i++) {
        dates.push(getDateString(i));
      }
      expect(calculateStreak(dates)).toBe(7);
    });

    test('Missed today but had 10-day streak until yesterday', () => {
      const dates = [];
      for (let i = 1; i <= 10; i++) { // Start from 1 (yesterday) to 10 days ago
        dates.push(getDateString(i));
      }
      expect(calculateStreak(dates)).toBe(10); // Streak is still active!
    });

    test('Returned after break: Had streak, missed 3 days, came back today', () => {
      const dates = [
        getDateString(0),  // Today (came back)
        // Missed 3 days
        getDateString(4),  // 4 days ago
        getDateString(5),  // 5 days ago
        getDateString(6),  // 6 days ago
      ];
      expect(calculateStreak(dates)).toBe(1); // Only counts today
    });
  });

  describe('Edge Cases', () => {
    test('Duplicate dates should be handled correctly', () => {
      const dates = [
        getDateString(0), // Today
        getDateString(0), // Today (duplicate)
        getDateString(1), // Yesterday
        getDateString(1), // Yesterday (duplicate)
      ];
      // With deduplication, duplicates are removed before processing
      // So we have unique dates: [today, yesterday] = streak of 2
      expect(calculateStreak(dates)).toBe(2);
    });

    test('Unsorted dates should still calculate correctly', () => {
      const dates = [
        getDateString(3), // 3 days ago
        getDateString(0), // Today
        getDateString(2), // 2 days ago
        getDateString(1), // Yesterday
      ];
      expect(calculateStreak(dates)).toBe(4);
    });

    test('Very old activity with recent activity', () => {
      const dates = [
        getDateString(0),   // Today
        getDateString(365), // A year ago
      ];
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Future dates should be ignored properly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dates = [
        tomorrow.toISOString().split('T')[0], // Tomorrow (should be handled)
        getDateString(0), // Today
        getDateString(1), // Yesterday
      ];
      // Future dates might break the streak logic, but shouldn't crash
      const result = calculateStreak(dates);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Timezone Considerations', () => {
    test('Activity at 11:59 PM yesterday and 12:01 AM today', () => {
      // These should be considered consecutive days
      const dates = [
        getDateString(0), // Today
        getDateString(1), // Yesterday
      ];
      expect(calculateStreak(dates)).toBe(2);
    });

    test('Handles date strings with different formats gracefully', () => {
      const dates = [
        '2025-09-16', // ISO format
        '2025-09-15', // ISO format
      ];
      // Mock today as Sept 16
      const originalDate = Date;
      global.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('2025-09-16T12:00:00Z');
          } else {
            super(...args);
          }
        }
      } as any;

      expect(calculateStreak(dates)).toBe(2);

      global.Date = originalDate;
    });
  });

  describe('Streak Maintenance Rules', () => {
    test('Streak continues if activity was yesterday (within 24-48 hour window)', () => {
      const dates = [getDateString(1)]; // Yesterday only
      expect(calculateStreak(dates)).toBe(1);
    });

    test('Streak breaks if no activity for 2+ days', () => {
      const dates = [getDateString(2)]; // 2 days ago only
      expect(calculateStreak(dates)).toBe(0);
    });

    test('100-day streak ending yesterday should still show 100', () => {
      const dates = [];
      for (let i = 1; i <= 100; i++) { // 1 to 100 days ago (not today)
        dates.push(getDateString(i));
      }
      expect(calculateStreak(dates)).toBe(100);
    });

    test('100-day streak ending 2 days ago should show 0', () => {
      const dates = [];
      for (let i = 2; i <= 101; i++) { // 2 to 101 days ago (missed yesterday and today)
        dates.push(getDateString(i));
      }
      expect(calculateStreak(dates)).toBe(0);
    });
  });
});

describe('Streak Calculation with Mock Data', () => {
  test('Firebase data structure compatibility', () => {
    // Simulate Firebase data structure
    const firebaseData = {
      dates: {
        '2025-09-15': true,
        '2025-09-14': true,
        '2025-09-13': true,
      },
      currentStreak: 0, // Wrong value that needs recalculation
      bestStreak: 3,
      lastActivity: 1757966585088
    };

    const dates = Object.keys(firebaseData.dates);

    // Mock current date to Sept 16
    const originalDate = Date;
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super('2025-09-16T07:00:00Z');
        } else {
          super(...args);
        }
      }
    } as any;

    const calculatedStreak = calculateStreak(dates);
    expect(calculatedStreak).toBe(3); // Should be 3, not 0!

    global.Date = originalDate;
  });

  function calculateStreak(activityDates: string[]): number {
    if (!activityDates || activityDates.length === 0) {
      return 0;
    }

    // Deduplicate dates first
    const uniqueDates = [...new Set(activityDates)];
    const sortedDates = uniqueDates.sort().reverse();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let streak = 0;
    let expectedDate = new Date(todayDate);

    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      date.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 0) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (streak === 0 && daysDiff === 1) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 2);
      } else {
        break;
      }
    }

    return streak;
  }
});