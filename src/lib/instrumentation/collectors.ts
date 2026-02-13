/**
 * Metric Collectors
 *
 * Non-blocking, low-overhead collectors that accumulate measurement samples
 * and produce percentile results for each acceptance gate metric.
 *
 * Each collector implements the MetricCollector interface for consistency.
 * All operations are synchronous and O(1) for recording, O(n log n) for results.
 */

import type {
  MetricCollector,
  PercentileResult,
  SegmentDurationSample,
  SegmentLengthSample,
  HighlightErrorSample,
  LoopOvershootSample,
  HardDriftSample,
  PlaybackMinuteSample,
  SegmentationMetrics,
  SyncMetrics,
} from './types';
import { computePercentiles, exceedanceRate, incidentRate } from './metrics';

// ============================================================================
// SEGMENT DURATION COLLECTOR
// ============================================================================

/**
 * Collects segment duration measurements and computes percentiles.
 *
 * Acceptance gate targets:
 * - Median: 2.5s to 6.0s
 * - P90: <= 8.0s
 * - P95: <= 10.0s
 * - Oversized (>12s): < 1%
 */
export class SegmentDurationCollector
  implements MetricCollector<SegmentDurationSample, PercentileResult>
{
  private samples: number[] = [];

  record(sample: SegmentDurationSample): void {
    this.samples.push(sample.durationSec);
  }

  /** Record a batch of segments (e.g., from a full transcript). */
  recordBatch(segments: { start: number; end: number }[]): void {
    for (let i = 0; i < segments.length; i++) {
      this.samples.push(segments[i].end - segments[i].start);
    }
  }

  getResult(): PercentileResult {
    return computePercentiles(this.samples);
  }

  /** Fraction of segments >12s */
  getOversizedRate(): number {
    return exceedanceRate(this.samples, 12);
  }

  getSampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// SEGMENT LENGTH COLLECTOR
// ============================================================================

/**
 * Collects segment text length (character count) measurements.
 *
 * Acceptance gate target:
 * - 30 to 110 characters (language-dependent)
 */
export class SegmentLengthCollector
  implements MetricCollector<SegmentLengthSample, PercentileResult>
{
  private samples: number[] = [];

  record(sample: SegmentLengthSample): void {
    this.samples.push(sample.charCount);
  }

  /** Record a batch of segments from transcript text. */
  recordBatch(segments: { text: string }[]): void {
    for (let i = 0; i < segments.length; i++) {
      this.samples.push(segments[i].text.trim().length);
    }
  }

  getResult(): PercentileResult {
    return computePercentiles(this.samples);
  }

  getSampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// HIGHLIGHT ERROR COLLECTOR
// ============================================================================

/**
 * Collects active segment highlight error measurements.
 * Separates desktop and mobile measurements.
 *
 * Acceptance gate targets:
 * - Desktop median: <= 120ms
 * - Desktop P95: <= 250ms
 * - Mobile median: <= 180ms
 * - Mobile P95: <= 350ms
 */
export class HighlightErrorCollector
  implements MetricCollector<HighlightErrorSample, { desktop: PercentileResult; mobile: PercentileResult }>
{
  private desktopSamples: number[] = [];
  private mobileSamples: number[] = [];

  record(sample: HighlightErrorSample): void {
    if (sample.platform === 'desktop') {
      this.desktopSamples.push(sample.errorMs);
    } else {
      this.mobileSamples.push(sample.errorMs);
    }
  }

  getResult(): { desktop: PercentileResult; mobile: PercentileResult } {
    return {
      desktop: computePercentiles(this.desktopSamples),
      mobile: computePercentiles(this.mobileSamples),
    };
  }

  getSampleCount(): number {
    return this.desktopSamples.length + this.mobileSamples.length;
  }

  getDesktopSampleCount(): number {
    return this.desktopSamples.length;
  }

  getMobileSampleCount(): number {
    return this.mobileSamples.length;
  }

  reset(): void {
    this.desktopSamples = [];
    this.mobileSamples = [];
  }
}

// ============================================================================
// LOOP OVERSHOOT COLLECTOR
// ============================================================================

/**
 * Collects repeat loop boundary overshoot measurements.
 *
 * Acceptance gate targets:
 * - Median: <= 120ms
 * - P95: <= 220ms
 */
export class LoopOvershootCollector
  implements MetricCollector<LoopOvershootSample, PercentileResult>
{
  private samples: number[] = [];

  record(sample: LoopOvershootSample): void {
    this.samples.push(sample.overshootMs);
  }

  getResult(): PercentileResult {
    return computePercentiles(this.samples);
  }

  getSampleCount(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples = [];
  }
}

// ============================================================================
// HARD DRIFT COLLECTOR
// ============================================================================

/**
 * Collects hard drift incidents and playback minutes to compute
 * the drift incident rate.
 *
 * Hard drift: >500ms for >1.5s
 * Acceptance gate target: < 0.5% of playback minutes
 */
export class HardDriftCollector
  implements MetricCollector<HardDriftSample | PlaybackMinuteSample, number>
{
  private driftIncidents: HardDriftSample[] = [];
  private playbackMinutes: PlaybackMinuteSample[] = [];

  record(sample: HardDriftSample | PlaybackMinuteSample): void {
    if ('driftMs' in sample) {
      this.driftIncidents.push(sample);
    } else {
      this.playbackMinutes.push(sample);
    }
  }

  recordDrift(sample: HardDriftSample): void {
    this.driftIncidents.push(sample);
  }

  recordPlaybackMinute(sample: PlaybackMinuteSample): void {
    this.playbackMinutes.push(sample);
  }

  /** Returns the hard drift incident rate as a fraction of playback minutes. */
  getResult(): number {
    return incidentRate(this.playbackMinutes.map(m => m.hadDriftIncident));
  }

  /** Returns full drift incident details for reporting. */
  getDriftDetails(): HardDriftSample[] {
    return [...this.driftIncidents];
  }

  getSampleCount(): number {
    return this.playbackMinutes.length;
  }

  getDriftCount(): number {
    return this.driftIncidents.length;
  }

  reset(): void {
    this.driftIncidents = [];
    this.playbackMinutes = [];
  }
}

// ============================================================================
// UNIFIED METRICS FACADE
// ============================================================================

/**
 * Unified collector that aggregates all metric collectors
 * and produces complete SegmentationMetrics and SyncMetrics reports.
 *
 * Usage:
 * ```typescript
 * const collector = new InstrumentationCollector();
 *
 * // Record segment data
 * collector.segmentDuration.recordBatch(segments);
 * collector.segmentLength.recordBatch(segments);
 *
 * // Record sync events (from playback)
 * collector.highlightError.record({ segmentIndex: 0, errorMs: 85, ... });
 * collector.loopOvershoot.record({ segmentIndex: 0, overshootMs: 95, ... });
 *
 * // Generate report
 * const report = collector.getSegmentationMetrics();
 * const syncReport = collector.getSyncMetrics();
 * ```
 */
export class InstrumentationCollector {
  readonly segmentDuration = new SegmentDurationCollector();
  readonly segmentLength = new SegmentLengthCollector();
  readonly highlightError = new HighlightErrorCollector();
  readonly loopOvershoot = new LoopOvershootCollector();
  readonly hardDrift = new HardDriftCollector();

  getSegmentationMetrics(): SegmentationMetrics {
    return {
      segmentDuration: this.segmentDuration.getResult(),
      segmentLength: this.segmentLength.getResult(),
      oversizedSegmentRate: this.segmentDuration.getOversizedRate(),
    };
  }

  getSyncMetrics(): SyncMetrics {
    return {
      highlightError: this.highlightError.getResult(),
      loopOvershoot: this.loopOvershoot.getResult(),
      hardDriftIncidentRate: this.hardDrift.getResult(),
    };
  }

  getSampleCounts() {
    return {
      segmentDuration: this.segmentDuration.getSampleCount(),
      segmentLength: this.segmentLength.getSampleCount(),
      highlightErrorDesktop: this.highlightError.getDesktopSampleCount(),
      highlightErrorMobile: this.highlightError.getMobileSampleCount(),
      loopOvershoot: this.loopOvershoot.getSampleCount(),
      playbackMinutes: this.hardDrift.getSampleCount(),
      hardDriftIncidents: this.hardDrift.getDriftCount(),
    };
  }

  resetAll(): void {
    this.segmentDuration.reset();
    this.segmentLength.reset();
    this.highlightError.reset();
    this.loopOvershoot.reset();
    this.hardDrift.reset();
  }
}
