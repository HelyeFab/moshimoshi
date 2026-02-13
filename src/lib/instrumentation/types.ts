/**
 * Instrumentation Types
 *
 * Type definitions for YouTube Shadowing segmentation and sync
 * quality measurement infrastructure.
 */

// ============================================================================
// MEASUREMENT TYPES
// ============================================================================

/** A single segment duration measurement (seconds) */
export interface SegmentDurationSample {
  segmentIndex: number;
  durationSec: number;
}

/** A single segment text length measurement (characters) */
export interface SegmentLengthSample {
  segmentIndex: number;
  charCount: number;
}

/** A single highlight error measurement (milliseconds) */
export interface HighlightErrorSample {
  segmentIndex: number;
  errorMs: number;      // Absolute error in ms
  timestamp: number;    // When the measurement was taken
  platform: 'desktop' | 'mobile';
}

/** A single loop overshoot measurement (milliseconds) */
export interface LoopOvershootSample {
  segmentIndex: number;
  overshootMs: number;  // How far past the boundary the loop went
  repeatNumber: number;
  timestamp: number;
}

/** A hard drift incident (>500ms for >1.5s) */
export interface HardDriftSample {
  segmentIndex: number;
  driftMs: number;          // Peak drift in ms
  driftDurationSec: number; // How long the drift persisted
  timestamp: number;
}

/** Playback minute for drift rate calculation */
export interface PlaybackMinuteSample {
  minuteIndex: number;
  hadDriftIncident: boolean;
}

// ============================================================================
// PERCENTILE RESULT
// ============================================================================

export interface PercentileResult {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  count: number;
  stdDev: number;
}

// ============================================================================
// METRIC REPORT TYPES
// ============================================================================

export interface SegmentationMetrics {
  segmentDuration: PercentileResult;
  segmentLength: PercentileResult;
  oversizedSegmentRate: number; // Fraction of segments >12s
}

export interface SyncMetrics {
  highlightError: {
    desktop: PercentileResult;
    mobile: PercentileResult;
  };
  loopOvershoot: PercentileResult;
  hardDriftIncidentRate: number; // Fraction of playback minutes with drift
}

// ============================================================================
// ACCEPTANCE GATE TYPES
// ============================================================================

export type GateStatus = 'pass' | 'fail' | 'no_data';

export interface GateResult {
  name: string;
  metric: string;
  threshold: number;
  actual: number | null;
  unit: string;
  status: GateStatus;
}

export interface AcceptanceGateReport {
  gates: GateResult[];
  allPassed: boolean;
  passCount: number;
  failCount: number;
  noDataCount: number;
}

// ============================================================================
// BENCHMARK REPORT
// ============================================================================

export interface BenchmarkReport {
  version: '1.0.0';
  generatedAt: string;
  runId: string;
  segmentation: SegmentationMetrics;
  sync: SyncMetrics;
  acceptanceGates: AcceptanceGateReport;
  metadata: {
    sampleCounts: {
      segmentDuration: number;
      segmentLength: number;
      highlightErrorDesktop: number;
      highlightErrorMobile: number;
      loopOvershoot: number;
      playbackMinutes: number;
      hardDriftIncidents: number;
    };
    durationMs: number;
  };
}

// ============================================================================
// COLLECTOR INTERFACE
// ============================================================================

export interface MetricCollector<TSample, TResult> {
  record(sample: TSample): void;
  getResult(): TResult;
  getSampleCount(): number;
  reset(): void;
}

// ============================================================================
// ANALYTICS PAYLOAD (backward-compatible with existing tracking)
// ============================================================================

/**
 * Analytics event payload that extends existing practice tracking.
 * Fields are additive-only to maintain backward compatibility.
 */
export interface InstrumentationAnalyticsPayload {
  /** Existing fields (must not change) */
  videoId: string;
  practiceTime: number;

  /** New instrumentation fields (all optional) */
  instrumentation?: {
    segmentDurations?: number[];
    segmentLengths?: number[];
    highlightErrors?: { errorMs: number; platform: string }[];
    loopOvershoots?: { overshootMs: number }[];
    hardDrifts?: { driftMs: number; durationSec: number }[];
  };
}
