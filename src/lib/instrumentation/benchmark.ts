/**
 * Benchmark Harness
 *
 * Repeatable benchmark runner for segmentation and sync quality metrics.
 * Outputs machine-readable JSON reports for lead review.
 *
 * Usage:
 * ```typescript
 * const harness = new BenchmarkHarness();
 *
 * // Feed transcript segments
 * harness.ingestSegments(transcriptSegments);
 *
 * // Feed sync measurements (simulated or real)
 * harness.ingestHighlightErrors(highlightSamples);
 * harness.ingestLoopOvershoots(overshootSamples);
 * harness.ingestPlaybackMinutes(playbackSamples);
 *
 * // Generate report
 * const report = harness.generateReport();
 * console.log(JSON.stringify(report, null, 2));
 * ```
 */

import type {
  BenchmarkReport,
  HighlightErrorSample,
  LoopOvershootSample,
  HardDriftSample,
  PlaybackMinuteSample,
} from './types';
import { InstrumentationCollector } from './collectors';
import { evaluateAllGates } from './acceptance-gates';
import { roundTo } from './metrics';

// ============================================================================
// TEST DATA GENERATORS (for repeatable benchmarks)
// ============================================================================

export interface SyntheticSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Generate synthetic transcript segments for benchmarking.
 * Produces segments with realistic Japanese text length and timing.
 */
export function generateSyntheticSegments(
  count: number,
  options: {
    avgDurationSec?: number;
    durationVariance?: number;
    avgCharCount?: number;
    charVariance?: number;
    gapSec?: number;
  } = {}
): SyntheticSegment[] {
  const {
    avgDurationSec = 4.0,
    durationVariance = 1.5,
    avgCharCount = 40,
    charVariance = 15,
    gapSec = 0.2,
  } = options;

  const segments: SyntheticSegment[] = [];
  let currentTime = 0;

  // Use a seeded pseudo-random for reproducibility
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const duration = Math.max(0.5, avgDurationSec + (random() - 0.5) * 2 * durationVariance);
    const charCount = Math.max(5, Math.round(avgCharCount + (random() - 0.5) * 2 * charVariance));

    // Generate placeholder text of the target length
    const text = '\u3042'.repeat(charCount); // Use hiragana 'a' as filler

    segments.push({
      start: roundTo(currentTime, 3),
      end: roundTo(currentTime + duration, 3),
      text,
    });

    currentTime += duration + gapSec;
  }

  return segments;
}

/**
 * Generate synthetic highlight error samples.
 */
export function generateSyntheticHighlightErrors(
  count: number,
  platform: 'desktop' | 'mobile',
  options: {
    avgErrorMs?: number;
    errorVariance?: number;
  } = {}
): HighlightErrorSample[] {
  const {
    avgErrorMs = platform === 'desktop' ? 80 : 130,
    errorVariance = platform === 'desktop' ? 60 : 80,
  } = options;

  const samples: HighlightErrorSample[] = [];
  let seed = 123;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const errorMs = Math.max(0, avgErrorMs + (random() - 0.5) * 2 * errorVariance);
    samples.push({
      segmentIndex: i % 50,
      errorMs: roundTo(errorMs, 1),
      timestamp: Date.now() + i * 1000,
      platform,
    });
  }

  return samples;
}

/**
 * Generate synthetic loop overshoot samples.
 */
export function generateSyntheticLoopOvershoots(
  count: number,
  options: {
    avgOvershootMs?: number;
    overshootVariance?: number;
  } = {}
): LoopOvershootSample[] {
  const {
    avgOvershootMs = 80,
    overshootVariance = 50,
  } = options;

  const samples: LoopOvershootSample[] = [];
  let seed = 456;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const overshootMs = Math.max(0, avgOvershootMs + (random() - 0.5) * 2 * overshootVariance);
    samples.push({
      segmentIndex: i % 50,
      overshootMs: roundTo(overshootMs, 1),
      repeatNumber: (i % 3) + 1,
      timestamp: Date.now() + i * 2000,
    });
  }

  return samples;
}

/**
 * Generate synthetic playback minute samples with configurable drift rate.
 */
export function generateSyntheticPlaybackMinutes(
  count: number,
  driftRate: number = 0.003 // 0.3% by default
): PlaybackMinuteSample[] {
  const samples: PlaybackMinuteSample[] = [];
  let seed = 789;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    samples.push({
      minuteIndex: i,
      hadDriftIncident: random() < driftRate,
    });
  }

  return samples;
}

// ============================================================================
// BENCHMARK HARNESS
// ============================================================================

export class BenchmarkHarness {
  private collector = new InstrumentationCollector();
  private startTime = 0;

  /**
   * Ingest transcript segments for segmentation quality analysis.
   */
  ingestSegments(segments: { start: number; end: number; text: string }[]): void {
    this.collector.segmentDuration.recordBatch(segments);
    this.collector.segmentLength.recordBatch(segments);
  }

  /**
   * Ingest highlight error measurements.
   */
  ingestHighlightErrors(samples: HighlightErrorSample[]): void {
    for (const sample of samples) {
      this.collector.highlightError.record(sample);
    }
  }

  /**
   * Ingest loop overshoot measurements.
   */
  ingestLoopOvershoots(samples: LoopOvershootSample[]): void {
    for (const sample of samples) {
      this.collector.loopOvershoot.record(sample);
    }
  }

  /**
   * Ingest hard drift incidents.
   */
  ingestHardDrifts(samples: HardDriftSample[]): void {
    for (const sample of samples) {
      this.collector.hardDrift.recordDrift(sample);
    }
  }

  /**
   * Ingest playback minute samples for drift rate calculation.
   */
  ingestPlaybackMinutes(samples: PlaybackMinuteSample[]): void {
    for (const sample of samples) {
      this.collector.hardDrift.recordPlaybackMinute(sample);
    }
  }

  /**
   * Run a full benchmark with synthetic data.
   * Useful for smoke testing the instrumentation pipeline.
   */
  runSyntheticBenchmark(options: {
    segmentCount?: number;
    highlightSampleCount?: number;
    overshootSampleCount?: number;
    playbackMinuteCount?: number;
    driftRate?: number;
  } = {}): BenchmarkReport {
    const {
      segmentCount = 100,
      highlightSampleCount = 200,
      overshootSampleCount = 100,
      playbackMinuteCount = 300,
      driftRate = 0.003,
    } = options;

    this.reset();

    const segments = generateSyntheticSegments(segmentCount);
    this.ingestSegments(segments);

    const desktopErrors = generateSyntheticHighlightErrors(
      Math.floor(highlightSampleCount / 2),
      'desktop'
    );
    const mobileErrors = generateSyntheticHighlightErrors(
      Math.ceil(highlightSampleCount / 2),
      'mobile'
    );
    this.ingestHighlightErrors([...desktopErrors, ...mobileErrors]);

    const overshoots = generateSyntheticLoopOvershoots(overshootSampleCount);
    this.ingestLoopOvershoots(overshoots);

    const playbackMinutes = generateSyntheticPlaybackMinutes(playbackMinuteCount, driftRate);
    this.ingestPlaybackMinutes(playbackMinutes);

    return this.generateReport();
  }

  /**
   * Generate the full benchmark report in machine-readable JSON format.
   */
  generateReport(): BenchmarkReport {
    const endTime = performance.now();
    const durationMs = this.startTime > 0 ? roundTo(endTime - this.startTime, 2) : 0;

    const segmentation = this.collector.getSegmentationMetrics();
    const sync = this.collector.getSyncMetrics();
    const acceptanceGates = evaluateAllGates(segmentation, sync);

    return {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      runId: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      segmentation: {
        segmentDuration: roundPercentileResult(segmentation.segmentDuration),
        segmentLength: roundPercentileResult(segmentation.segmentLength),
        oversizedSegmentRate: roundTo(segmentation.oversizedSegmentRate, 4),
      },
      sync: {
        highlightError: {
          desktop: roundPercentileResult(sync.highlightError.desktop),
          mobile: roundPercentileResult(sync.highlightError.mobile),
        },
        loopOvershoot: roundPercentileResult(sync.loopOvershoot),
        hardDriftIncidentRate: roundTo(sync.hardDriftIncidentRate, 4),
      },
      acceptanceGates: {
        ...acceptanceGates,
        gates: acceptanceGates.gates.map(g => ({
          ...g,
          actual: g.actual !== null ? roundTo(g.actual, 4) : null,
        })),
      },
      metadata: {
        sampleCounts: this.collector.getSampleCounts(),
        durationMs,
      },
    };
  }

  /**
   * Start timing the benchmark run.
   */
  startTiming(): void {
    this.startTime = performance.now();
  }

  /**
   * Reset all collectors for a fresh run.
   */
  reset(): void {
    this.collector.resetAll();
    this.startTime = performance.now();
  }

  /**
   * Get the underlying collector for advanced use.
   */
  getCollector(): InstrumentationCollector {
    return this.collector;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function roundPercentileResult(result: {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  count: number;
  stdDev: number;
}) {
  return {
    min: roundTo(result.min, 3),
    max: roundTo(result.max, 3),
    mean: roundTo(result.mean, 3),
    median: roundTo(result.median, 3),
    p90: roundTo(result.p90, 3),
    p95: roundTo(result.p95, 3),
    count: result.count,
    stdDev: roundTo(result.stdDev, 3),
  };
}
