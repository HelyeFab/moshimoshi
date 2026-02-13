/**
 * Direct unit tests for acceptance gate evaluation functions.
 *
 * Tests evaluateSegmentationGates, evaluateSyncGates, and evaluateAllGates
 * independently of the benchmark harness, covering edge cases and
 * threshold boundary conditions.
 */

import {
  evaluateSegmentationGates,
  evaluateSyncGates,
  evaluateAllGates,
  SEGMENTATION_THRESHOLDS,
  SYNC_THRESHOLDS,
} from '../acceptance-gates';
import { computePercentiles } from '../metrics';
import type { SegmentationMetrics, SyncMetrics, PercentileResult } from '../types';

// ============================================================================
// HELPERS
// ============================================================================

function makePercentileResult(overrides: Partial<PercentileResult> = {}): PercentileResult {
  return {
    min: 0,
    max: 0,
    mean: 0,
    median: 0,
    p90: 0,
    p95: 0,
    count: 0,
    stdDev: 0,
    ...overrides,
  };
}

function makeSegmentationMetrics(
  overrides: Partial<SegmentationMetrics> = {}
): SegmentationMetrics {
  return {
    segmentDuration: makePercentileResult({ count: 100, median: 4.0, p90: 6.5, p95: 8.0 }),
    segmentLength: makePercentileResult({ count: 100, median: 50 }),
    oversizedSegmentRate: 0,
    ...overrides,
  };
}

function makeSyncMetrics(overrides: Partial<SyncMetrics> = {}): SyncMetrics {
  return {
    highlightError: {
      desktop: makePercentileResult({ count: 50, median: 80, p95: 200 }),
      mobile: makePercentileResult({ count: 50, median: 120, p95: 280 }),
    },
    loopOvershoot: makePercentileResult({ count: 50, median: 80, p95: 180 }),
    hardDriftIncidentRate: 0.002,
    ...overrides,
  };
}

// ============================================================================
// evaluateSegmentationGates
// ============================================================================

describe('evaluateSegmentationGates', () => {
  it('should pass all gates with ideal metrics', () => {
    const metrics = makeSegmentationMetrics();
    const gates = evaluateSegmentationGates(metrics);

    const failedGates = gates.filter(g => g.status === 'fail');
    expect(failedGates).toHaveLength(0);
  });

  it('should return 7 gates total', () => {
    const gates = evaluateSegmentationGates(makeSegmentationMetrics());
    expect(gates).toHaveLength(7);
  });

  it('should fail when median duration is below lower bound', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 100, median: 1.5, p90: 3.0, p95: 4.0 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const lowerBound = gates.find(g => g.name === 'Median segment duration (lower bound)');
    expect(lowerBound?.status).toBe('fail');
    expect(lowerBound?.actual).toBe(1.5);
    expect(lowerBound?.threshold).toBe(SEGMENTATION_THRESHOLDS.medianDurationMin);
  });

  it('should fail when median duration exceeds upper bound', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 100, median: 8.0, p90: 10, p95: 12 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const upperBound = gates.find(g => g.name === 'Median segment duration (upper bound)');
    expect(upperBound?.status).toBe('fail');
  });

  it('should pass when median duration is exactly at boundaries', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({
        count: 100,
        median: SEGMENTATION_THRESHOLDS.medianDurationMin,
        p90: 6.0,
        p95: 8.0,
      }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const lowerBound = gates.find(g => g.name === 'Median segment duration (lower bound)');
    expect(lowerBound?.status).toBe('pass');
  });

  it('should fail when P90 duration exceeds threshold', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 100, median: 4.0, p90: 9.0, p95: 10 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const p90Gate = gates.find(g => g.name === 'P90 segment duration');
    expect(p90Gate?.status).toBe('fail');
  });

  it('should fail when P95 duration exceeds threshold', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 100, median: 4.0, p90: 7.0, p95: 11.0 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const p95Gate = gates.find(g => g.name === 'P95 segment duration');
    expect(p95Gate?.status).toBe('fail');
  });

  it('should fail when oversized segment rate exceeds 1%', () => {
    const metrics = makeSegmentationMetrics({ oversizedSegmentRate: 0.02 });

    const gates = evaluateSegmentationGates(metrics);
    const oversizedGate = gates.find(g => g.metric === 'oversizedSegmentRate');
    expect(oversizedGate?.status).toBe('fail');
  });

  it('should pass when oversized segment rate is exactly 1%', () => {
    const metrics = makeSegmentationMetrics({ oversizedSegmentRate: 0.01 });

    const gates = evaluateSegmentationGates(metrics);
    const oversizedGate = gates.find(g => g.metric === 'oversizedSegmentRate');
    expect(oversizedGate?.status).toBe('pass');
  });

  it('should return no_data when segment duration has no samples', () => {
    const metrics = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 0 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const durationGates = gates.filter(g => g.metric.startsWith('segmentDuration'));
    expect(durationGates.every(g => g.status === 'no_data')).toBe(true);
  });

  it('should return no_data when segment length has no samples', () => {
    const metrics = makeSegmentationMetrics({
      segmentLength: makePercentileResult({ count: 0 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const lengthGates = gates.filter(g => g.metric.startsWith('segmentLength'));
    expect(lengthGates.every(g => g.status === 'no_data')).toBe(true);
  });

  it('should fail text length lower bound when median is too short', () => {
    const metrics = makeSegmentationMetrics({
      segmentLength: makePercentileResult({ count: 100, median: 20 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const lowerBound = gates.find(g => g.name === 'Segment text length (lower bound)');
    expect(lowerBound?.status).toBe('fail');
  });

  it('should fail text length upper bound when median is too long', () => {
    const metrics = makeSegmentationMetrics({
      segmentLength: makePercentileResult({ count: 100, median: 120 }),
    });

    const gates = evaluateSegmentationGates(metrics);
    const upperBound = gates.find(g => g.name === 'Segment text length (upper bound)');
    expect(upperBound?.status).toBe('fail');
  });
});

// ============================================================================
// evaluateSyncGates
// ============================================================================

describe('evaluateSyncGates', () => {
  it('should pass all gates with ideal metrics', () => {
    const metrics = makeSyncMetrics();
    const gates = evaluateSyncGates(metrics);

    const failedGates = gates.filter(g => g.status === 'fail');
    expect(failedGates).toHaveLength(0);
  });

  it('should return 7 gates total', () => {
    const gates = evaluateSyncGates(makeSyncMetrics());
    expect(gates).toHaveLength(7);
  });

  it('should fail when desktop highlight error median exceeds 120ms', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 50, median: 150, p95: 300 }),
        mobile: makePercentileResult({ count: 50, median: 120, p95: 280 }),
      },
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'highlightError.desktop.median');
    expect(gate?.status).toBe('fail');
  });

  it('should fail when desktop highlight error P95 exceeds 250ms', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 50, median: 100, p95: 280 }),
        mobile: makePercentileResult({ count: 50, median: 120, p95: 280 }),
      },
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'highlightError.desktop.p95');
    expect(gate?.status).toBe('fail');
  });

  it('should fail when mobile highlight error median exceeds 180ms', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 50, median: 80, p95: 200 }),
        mobile: makePercentileResult({ count: 50, median: 200, p95: 350 }),
      },
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'highlightError.mobile.median');
    expect(gate?.status).toBe('fail');
  });

  it('should fail when mobile highlight error P95 exceeds 350ms', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 50, median: 80, p95: 200 }),
        mobile: makePercentileResult({ count: 50, median: 150, p95: 400 }),
      },
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'highlightError.mobile.p95');
    expect(gate?.status).toBe('fail');
  });

  it('should pass at exact threshold boundaries', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({
          count: 50,
          median: SYNC_THRESHOLDS.highlightErrorDesktopMedian,
          p95: SYNC_THRESHOLDS.highlightErrorDesktopP95,
        }),
        mobile: makePercentileResult({
          count: 50,
          median: SYNC_THRESHOLDS.highlightErrorMobileMedian,
          p95: SYNC_THRESHOLDS.highlightErrorMobileP95,
        }),
      },
      loopOvershoot: makePercentileResult({
        count: 50,
        median: SYNC_THRESHOLDS.loopOvershootMedian,
        p95: SYNC_THRESHOLDS.loopOvershootP95,
      }),
      hardDriftIncidentRate: SYNC_THRESHOLDS.hardDriftIncidentRate,
    });

    const gates = evaluateSyncGates(metrics);
    const failedGates = gates.filter(g => g.status === 'fail');
    expect(failedGates).toHaveLength(0);
  });

  it('should fail when loop overshoot median exceeds 120ms', () => {
    const metrics = makeSyncMetrics({
      loopOvershoot: makePercentileResult({ count: 50, median: 150, p95: 220 }),
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'loopOvershoot.median');
    expect(gate?.status).toBe('fail');
  });

  it('should fail when loop overshoot P95 exceeds 220ms', () => {
    const metrics = makeSyncMetrics({
      loopOvershoot: makePercentileResult({ count: 50, median: 100, p95: 260 }),
    });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'loopOvershoot.p95');
    expect(gate?.status).toBe('fail');
  });

  it('should fail when hard drift rate exceeds 0.5%', () => {
    const metrics = makeSyncMetrics({ hardDriftIncidentRate: 0.008 });

    const gates = evaluateSyncGates(metrics);
    const gate = gates.find(g => g.metric === 'hardDriftIncidentRate');
    expect(gate?.status).toBe('fail');
  });

  it('should return no_data when desktop samples are missing', () => {
    const metrics = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 0 }),
        mobile: makePercentileResult({ count: 50, median: 120, p95: 280 }),
      },
    });

    const gates = evaluateSyncGates(metrics);
    const desktopGates = gates.filter(g => g.metric.startsWith('highlightError.desktop'));
    expect(desktopGates.every(g => g.status === 'no_data')).toBe(true);

    // Mobile should still evaluate
    const mobileGates = gates.filter(g => g.metric.startsWith('highlightError.mobile'));
    expect(mobileGates.every(g => g.status !== 'no_data')).toBe(true);
  });

  it('should return no_data when loop overshoot samples are missing', () => {
    const metrics = makeSyncMetrics({
      loopOvershoot: makePercentileResult({ count: 0 }),
    });

    const gates = evaluateSyncGates(metrics);
    const overshootGates = gates.filter(g => g.metric.startsWith('loopOvershoot'));
    expect(overshootGates.every(g => g.status === 'no_data')).toBe(true);
  });
});

// ============================================================================
// evaluateAllGates
// ============================================================================

describe('evaluateAllGates', () => {
  it('should return 14 gates total (7 segmentation + 7 sync)', () => {
    const report = evaluateAllGates(makeSegmentationMetrics(), makeSyncMetrics());
    expect(report.gates).toHaveLength(14);
  });

  it('should pass all with ideal data', () => {
    const report = evaluateAllGates(makeSegmentationMetrics(), makeSyncMetrics());
    expect(report.allPassed).toBe(true);
    expect(report.failCount).toBe(0);
    expect(report.noDataCount).toBe(0);
  });

  it('should NOT pass when any gate fails', () => {
    const seg = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 100, median: 1.0, p90: 2.0, p95: 3.0 }),
    });
    const report = evaluateAllGates(seg, makeSyncMetrics());

    expect(report.allPassed).toBe(false);
    expect(report.failCount).toBeGreaterThan(0);
  });

  it('should NOT pass when no_data gates exist (regression for blocking fix)', () => {
    const seg = makeSegmentationMetrics({
      segmentDuration: makePercentileResult({ count: 0 }), // no data
      segmentLength: makePercentileResult({ count: 0 }),    // no data
    });
    const sync = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 0 }),
        mobile: makePercentileResult({ count: 0 }),
      },
      loopOvershoot: makePercentileResult({ count: 0 }),
    });

    const report = evaluateAllGates(seg, sync);

    // Key assertion: even with zero fails, no_data must prevent allPassed
    expect(report.failCount).toBe(0);
    expect(report.noDataCount).toBeGreaterThan(0);
    expect(report.allPassed).toBe(false);
  });

  it('should correctly count pass/fail/no_data', () => {
    const seg = makeSegmentationMetrics({
      oversizedSegmentRate: 0.05, // fail: > 1%
    });
    const sync = makeSyncMetrics({
      highlightError: {
        desktop: makePercentileResult({ count: 0 }), // no_data
        mobile: makePercentileResult({ count: 50, median: 120, p95: 280 }),
      },
    });

    const report = evaluateAllGates(seg, sync);

    expect(report.failCount).toBeGreaterThanOrEqual(1); // oversized rate
    expect(report.noDataCount).toBeGreaterThanOrEqual(2); // desktop median + p95
    expect(report.passCount).toBe(report.gates.length - report.failCount - report.noDataCount);
    expect(report.allPassed).toBe(false);
  });
});
