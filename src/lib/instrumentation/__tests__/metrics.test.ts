/**
 * Unit tests for core metric calculators.
 *
 * Covers: percentile, median, mean, stdDev, computePercentiles,
 * exceedanceRate, incidentRate, isInRange, meetsThreshold, roundTo.
 */

import {
  percentile,
  median,
  mean,
  stdDev,
  computePercentiles,
  exceedanceRate,
  incidentRate,
  isInRange,
  meetsThreshold,
  roundTo,
} from '../metrics';

describe('percentile', () => {
  it('should return 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('should return the only value for single-element array', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  it('should return min for P0', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  it('should return max for P100', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });

  it('should return median for P50 with odd count', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('should interpolate P50 with even count', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });

  it('should calculate P90 correctly', () => {
    // 10 elements: P90 = index 8.1 → interpolate between sorted[8] and sorted[9]
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = percentile(sorted, 90);
    // rank = 0.9 * 9 = 8.1 → sorted[8] + 0.1 * (sorted[9] - sorted[8]) = 9 + 0.1 = 9.1
    expect(result).toBeCloseTo(9.1, 5);
  });

  it('should calculate P95 correctly', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    const result = percentile(sorted, 95);
    // rank = 0.95 * 99 = 94.05 → sorted[94] + 0.05 * (sorted[95] - sorted[94])
    // = 95 + 0.05 * 1 = 95.05
    expect(result).toBeCloseTo(95.05, 5);
  });

  it('should handle negative percentile values', () => {
    expect(percentile([1, 2, 3], -10)).toBe(1);
  });

  it('should handle percentile values > 100', () => {
    expect(percentile([1, 2, 3], 110)).toBe(3);
  });
});

describe('median', () => {
  it('should return 0 for empty array', () => {
    expect(median([])).toBe(0);
  });

  it('should return single value', () => {
    expect(median([5])).toBe(5);
  });

  it('should return middle value for odd count', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('should average middle values for even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('should not modify the original array', () => {
    const original = [3, 1, 2];
    median(original);
    expect(original).toEqual([3, 1, 2]);
  });

  it('should handle duplicate values', () => {
    expect(median([5, 5, 5, 5])).toBe(5);
  });
});

describe('mean', () => {
  it('should return 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('should calculate correct mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should handle single value', () => {
    expect(mean([42])).toBe(42);
  });

  it('should handle negative values', () => {
    expect(mean([-2, 0, 2])).toBe(0);
  });
});

describe('stdDev', () => {
  it('should return 0 for empty array', () => {
    expect(stdDev([])).toBe(0);
  });

  it('should return 0 for single value', () => {
    expect(stdDev([5])).toBe(0);
  });

  it('should return 0 for identical values', () => {
    expect(stdDev([3, 3, 3, 3])).toBe(0);
  });

  it('should calculate correct standard deviation', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean = 5, sample stddev ≈ 2.138
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });
});

describe('computePercentiles', () => {
  it('should return zeros for empty array', () => {
    const result = computePercentiles([]);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
    expect(result.mean).toBe(0);
    expect(result.median).toBe(0);
    expect(result.p90).toBe(0);
    expect(result.p95).toBe(0);
    expect(result.count).toBe(0);
    expect(result.stdDev).toBe(0);
  });

  it('should compute all metrics for a typical dataset', () => {
    const values = [2.1, 3.5, 4.0, 4.2, 5.0, 5.5, 6.0, 7.2, 8.0, 10.0];
    const result = computePercentiles(values);

    expect(result.min).toBe(2.1);
    expect(result.max).toBe(10.0);
    expect(result.count).toBe(10);
    expect(result.mean).toBeCloseTo(5.55, 2);
    expect(result.median).toBeCloseTo(5.25, 2);
    expect(result.p90).toBeGreaterThan(8.0);
    expect(result.p95).toBeGreaterThan(9.0);
    expect(result.stdDev).toBeGreaterThan(0);
  });

  it('should handle single value', () => {
    const result = computePercentiles([42]);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.median).toBe(42);
    expect(result.p90).toBe(42);
    expect(result.p95).toBe(42);
    expect(result.count).toBe(1);
  });

  it('should complete in <10ms for 1000 samples', () => {
    const values = Array.from({ length: 1000 }, () => Math.random() * 100);
    const start = performance.now();
    computePercentiles(values);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });
});

describe('exceedanceRate', () => {
  it('should return 0 for empty array', () => {
    expect(exceedanceRate([], 5)).toBe(0);
  });

  it('should return 0 when no values exceed threshold', () => {
    expect(exceedanceRate([1, 2, 3], 5)).toBe(0);
  });

  it('should return 1 when all values exceed threshold', () => {
    expect(exceedanceRate([10, 20, 30], 5)).toBe(1);
  });

  it('should calculate correct rate for mixed values', () => {
    // 2 out of 10 exceed threshold of 12
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 13, 15];
    expect(exceedanceRate(values, 12)).toBeCloseTo(0.2, 5);
  });

  it('should not count values equal to threshold', () => {
    expect(exceedanceRate([5, 5, 5], 5)).toBe(0);
  });
});

describe('incidentRate', () => {
  it('should return 0 for empty array', () => {
    expect(incidentRate([])).toBe(0);
  });

  it('should return 0 when no incidents', () => {
    expect(incidentRate([false, false, false])).toBe(0);
  });

  it('should return 1 when all incidents', () => {
    expect(incidentRate([true, true, true])).toBe(1);
  });

  it('should calculate correct rate', () => {
    const incidents = [true, false, false, true, false, false, false, false, false, false];
    expect(incidentRate(incidents)).toBeCloseTo(0.2, 5);
  });
});

describe('isInRange', () => {
  it('should return true for value within range', () => {
    expect(isInRange(5, 1, 10)).toBe(true);
  });

  it('should return true for value at boundaries', () => {
    expect(isInRange(1, 1, 10)).toBe(true);
    expect(isInRange(10, 1, 10)).toBe(true);
  });

  it('should return false for value outside range', () => {
    expect(isInRange(0, 1, 10)).toBe(false);
    expect(isInRange(11, 1, 10)).toBe(false);
  });
});

describe('meetsThreshold', () => {
  it('should return true when value is below threshold', () => {
    expect(meetsThreshold(80, 120)).toBe(true);
  });

  it('should return true when value equals threshold', () => {
    expect(meetsThreshold(120, 120)).toBe(true);
  });

  it('should return false when value exceeds threshold', () => {
    expect(meetsThreshold(121, 120)).toBe(false);
  });
});

describe('roundTo', () => {
  it('should round to 0 decimal places', () => {
    expect(roundTo(3.14159, 0)).toBe(3);
  });

  it('should round to 2 decimal places', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
  });

  it('should round to 4 decimal places', () => {
    expect(roundTo(3.14159, 4)).toBe(3.1416);
  });

  it('should handle negative numbers', () => {
    expect(roundTo(-2.5, 0)).toBe(-2); // banker's rounding behavior may vary
  });

  it('should handle zero', () => {
    expect(roundTo(0, 5)).toBe(0);
  });
});
