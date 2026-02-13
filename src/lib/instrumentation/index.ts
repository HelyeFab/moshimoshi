/**
 * YouTube Shadowing Instrumentation
 *
 * Measurement infrastructure for segmentation and sync acceptance gates.
 * All instrumentation is passive (non-blocking, no behavior changes).
 *
 * Usage:
 * ```typescript
 * import { BenchmarkHarness, InstrumentationCollector } from '@/lib/instrumentation';
 *
 * // Quick benchmark with synthetic data
 * const harness = new BenchmarkHarness();
 * const report = harness.runSyntheticBenchmark();
 *
 * // Or collect real measurements
 * const collector = new InstrumentationCollector();
 * collector.segmentDuration.recordBatch(segments);
 * collector.highlightError.record({ segmentIndex: 0, errorMs: 85, ... });
 * ```
 */

export type {
  SegmentDurationSample,
  SegmentLengthSample,
  HighlightErrorSample,
  LoopOvershootSample,
  HardDriftSample,
  PlaybackMinuteSample,
  PercentileResult,
  SegmentationMetrics,
  SyncMetrics,
  GateResult,
  GateStatus,
  AcceptanceGateReport,
  BenchmarkReport,
  MetricCollector,
  InstrumentationAnalyticsPayload,
} from './types';

export {
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
} from './metrics';

export {
  SegmentDurationCollector,
  SegmentLengthCollector,
  HighlightErrorCollector,
  LoopOvershootCollector,
  HardDriftCollector,
  InstrumentationCollector,
} from './collectors';

export {
  SEGMENTATION_THRESHOLDS,
  SYNC_THRESHOLDS,
  evaluateSegmentationGates,
  evaluateSyncGates,
  evaluateAllGates,
} from './acceptance-gates';

export {
  BenchmarkHarness,
  generateSyntheticSegments,
  generateSyntheticHighlightErrors,
  generateSyntheticLoopOvershoots,
  generateSyntheticPlaybackMinutes,
} from './benchmark';
