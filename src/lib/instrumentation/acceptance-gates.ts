/**
 * Acceptance Gate Definitions
 *
 * Maps each instrumentation metric to its acceptance threshold
 * from 04-REVIEW-RUBRIC-AND-ACCEPTANCE-GATES.md.
 *
 * These gates are evaluated against collected metrics to produce
 * a pass/fail report for lead review.
 */

import type {
  GateResult,
  GateStatus,
  AcceptanceGateReport,
  SegmentationMetrics,
  SyncMetrics,
} from './types';

// ============================================================================
// THRESHOLD DEFINITIONS
// ============================================================================

export const SEGMENTATION_THRESHOLDS = {
  medianDurationMin: 2.5,   // seconds
  medianDurationMax: 6.0,   // seconds
  p90Duration: 8.0,         // seconds
  p95Duration: 10.0,        // seconds
  textLengthMin: 30,        // characters
  textLengthMax: 110,       // characters
  oversizedRate: 0.01,      // < 1% of segments >12s
} as const;

export const SYNC_THRESHOLDS = {
  highlightErrorDesktopMedian: 120,   // ms
  highlightErrorDesktopP95: 250,      // ms
  highlightErrorMobileMedian: 180,    // ms
  highlightErrorMobileP95: 350,       // ms
  loopOvershootMedian: 120,           // ms
  loopOvershootP95: 220,              // ms
  hardDriftIncidentRate: 0.005,       // < 0.5% of playback minutes
} as const;

// ============================================================================
// GATE EVALUATION
// ============================================================================

function evaluateGate(
  name: string,
  metric: string,
  threshold: number,
  actual: number | null,
  unit: string,
  comparator: 'lte' | 'gte' | 'range',
  rangeMax?: number
): GateResult {
  let status: GateStatus;

  if (actual === null) {
    status = 'no_data';
  } else if (comparator === 'lte') {
    status = actual <= threshold ? 'pass' : 'fail';
  } else if (comparator === 'gte') {
    status = actual >= threshold ? 'pass' : 'fail';
  } else {
    // range: threshold = min, rangeMax = max
    status = actual >= threshold && actual <= (rangeMax ?? Infinity) ? 'pass' : 'fail';
  }

  return { name, metric, threshold, actual, unit, status };
}

/**
 * Evaluate segmentation metrics against acceptance gates.
 */
export function evaluateSegmentationGates(
  metrics: SegmentationMetrics
): GateResult[] {
  const hasDuration = metrics.segmentDuration.count > 0;
  const hasLength = metrics.segmentLength.count > 0;

  return [
    evaluateGate(
      'Median segment duration (lower bound)',
      'segmentDuration.median',
      SEGMENTATION_THRESHOLDS.medianDurationMin,
      hasDuration ? metrics.segmentDuration.median : null,
      's',
      'gte'
    ),
    evaluateGate(
      'Median segment duration (upper bound)',
      'segmentDuration.median',
      SEGMENTATION_THRESHOLDS.medianDurationMax,
      hasDuration ? metrics.segmentDuration.median : null,
      's',
      'lte'
    ),
    evaluateGate(
      'P90 segment duration',
      'segmentDuration.p90',
      SEGMENTATION_THRESHOLDS.p90Duration,
      hasDuration ? metrics.segmentDuration.p90 : null,
      's',
      'lte'
    ),
    evaluateGate(
      'P95 segment duration',
      'segmentDuration.p95',
      SEGMENTATION_THRESHOLDS.p95Duration,
      hasDuration ? metrics.segmentDuration.p95 : null,
      's',
      'lte'
    ),
    evaluateGate(
      'Segment text length (lower bound)',
      'segmentLength.median',
      SEGMENTATION_THRESHOLDS.textLengthMin,
      hasLength ? metrics.segmentLength.median : null,
      'chars',
      'gte'
    ),
    evaluateGate(
      'Segment text length (upper bound)',
      'segmentLength.median',
      SEGMENTATION_THRESHOLDS.textLengthMax,
      hasLength ? metrics.segmentLength.median : null,
      'chars',
      'lte'
    ),
    evaluateGate(
      'Oversized segment rate (<1%)',
      'oversizedSegmentRate',
      SEGMENTATION_THRESHOLDS.oversizedRate,
      hasDuration ? metrics.oversizedSegmentRate : null,
      'fraction',
      'lte'
    ),
  ];
}

/**
 * Evaluate sync metrics against acceptance gates.
 */
export function evaluateSyncGates(metrics: SyncMetrics): GateResult[] {
  const hasDesktop = metrics.highlightError.desktop.count > 0;
  const hasMobile = metrics.highlightError.mobile.count > 0;
  const hasOvershoot = metrics.loopOvershoot.count > 0;
  // hardDriftIncidentRate is 0 when no playback minutes recorded, which is valid

  return [
    evaluateGate(
      'Desktop highlight error (median)',
      'highlightError.desktop.median',
      SYNC_THRESHOLDS.highlightErrorDesktopMedian,
      hasDesktop ? metrics.highlightError.desktop.median : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Desktop highlight error (P95)',
      'highlightError.desktop.p95',
      SYNC_THRESHOLDS.highlightErrorDesktopP95,
      hasDesktop ? metrics.highlightError.desktop.p95 : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Mobile highlight error (median)',
      'highlightError.mobile.median',
      SYNC_THRESHOLDS.highlightErrorMobileMedian,
      hasMobile ? metrics.highlightError.mobile.median : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Mobile highlight error (P95)',
      'highlightError.mobile.p95',
      SYNC_THRESHOLDS.highlightErrorMobileP95,
      hasMobile ? metrics.highlightError.mobile.p95 : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Loop overshoot (median)',
      'loopOvershoot.median',
      SYNC_THRESHOLDS.loopOvershootMedian,
      hasOvershoot ? metrics.loopOvershoot.median : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Loop overshoot (P95)',
      'loopOvershoot.p95',
      SYNC_THRESHOLDS.loopOvershootP95,
      hasOvershoot ? metrics.loopOvershoot.p95 : null,
      'ms',
      'lte'
    ),
    evaluateGate(
      'Hard drift incident rate (<0.5%)',
      'hardDriftIncidentRate',
      SYNC_THRESHOLDS.hardDriftIncidentRate,
      metrics.hardDriftIncidentRate,
      'fraction',
      'lte'
    ),
  ];
}

/**
 * Evaluate all acceptance gates and produce a summary report.
 */
export function evaluateAllGates(
  segmentation: SegmentationMetrics,
  sync: SyncMetrics
): AcceptanceGateReport {
  const gates = [
    ...evaluateSegmentationGates(segmentation),
    ...evaluateSyncGates(sync),
  ];

  const passCount = gates.filter(g => g.status === 'pass').length;
  const failCount = gates.filter(g => g.status === 'fail').length;
  const noDataCount = gates.filter(g => g.status === 'no_data').length;

  return {
    gates,
    allPassed: failCount === 0 && noDataCount === 0,
    passCount,
    failCount,
    noDataCount,
  };
}
