/**
 * Core Metric Calculators
 *
 * Pure statistical functions for computing percentiles, medians,
 * and incident rates from measurement samples.
 *
 * Performance target: <10ms for typical data sets (1000 samples).
 */

import type { PercentileResult } from './types';

/**
 * Compute a specific percentile from a sorted array of numbers.
 * Uses linear interpolation between closest ranks.
 *
 * @param sorted - Pre-sorted array of numbers (ascending)
 * @param p - Percentile value (0-100)
 * @returns The interpolated percentile value
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];

  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return sorted[lower];

  const fraction = rank - lower;
  return sorted[lower] + fraction * (sorted[upper] - sorted[lower]);
}

/**
 * Compute the median of an array of numbers.
 *
 * @param values - Array of numbers (will be sorted internally)
 * @returns The median value
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return percentile(sorted, 50);
}

/**
 * Compute the mean of an array of numbers.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Compute the standard deviation of an array of numbers.
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map(v => (v - m) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

/**
 * Compute a full percentile result from raw values.
 * Computes min, max, mean, median, P90, P95, count, and stdDev in one pass.
 *
 * @param values - Array of raw measurement values
 * @returns Complete percentile breakdown
 */
export function computePercentiles(values: number[]): PercentileResult {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p90: 0,
      p95: 0,
      count: 0,
      stdDev: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: mean(values),
    median: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    count: values.length,
    stdDev: stdDev(values),
  };
}

/**
 * Compute the fraction of values exceeding a threshold.
 *
 * @param values - Array of measurement values
 * @param threshold - The threshold to check against
 * @returns Fraction of values > threshold (0.0 to 1.0)
 */
export function exceedanceRate(values: number[], threshold: number): number {
  if (values.length === 0) return 0;
  const count = values.filter(v => v > threshold).length;
  return count / values.length;
}

/**
 * Compute the incident rate from boolean samples.
 *
 * @param incidents - Array of booleans (true = incident occurred)
 * @returns Fraction of true values (0.0 to 1.0)
 */
export function incidentRate(incidents: boolean[]): number {
  if (incidents.length === 0) return 0;
  const count = incidents.filter(Boolean).length;
  return count / incidents.length;
}

/**
 * Determine if a value falls within an acceptable range.
 *
 * @param value - The measured value
 * @param min - Minimum acceptable value (inclusive)
 * @param max - Maximum acceptable value (inclusive)
 * @returns true if value is within [min, max]
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Determine if a value meets a "less than or equal" threshold.
 */
export function meetsThreshold(value: number, threshold: number): boolean {
  return value <= threshold;
}

/**
 * Round a number to a specified number of decimal places.
 * Used for report output formatting.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
