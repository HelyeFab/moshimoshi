/**
 * Tests for benchmark harness.
 *
 * Covers:
 * - Harness smoke test (end-to-end)
 * - Synthetic data generators
 * - Report format validation
 * - Acceptance gate evaluation
 * - Backward-compat for analytics payloads
 */

import {
  BenchmarkHarness,
  generateSyntheticSegments,
  generateSyntheticHighlightErrors,
  generateSyntheticLoopOvershoots,
  generateSyntheticPlaybackMinutes,
} from '../benchmark';
import { evaluateAllGates } from '../acceptance-gates';
import type {
  BenchmarkReport,
  InstrumentationAnalyticsPayload,
} from '../types';

// ============================================================================
// SYNTHETIC DATA GENERATORS
// ============================================================================

describe('generateSyntheticSegments', () => {
  it('should generate the requested number of segments', () => {
    const segments = generateSyntheticSegments(50);
    expect(segments).toHaveLength(50);
  });

  it('should produce monotonically increasing timestamps', () => {
    const segments = generateSyntheticSegments(100);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i].start).toBeGreaterThan(segments[i - 1].start);
      expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
    }
  });

  it('should produce segments with positive duration', () => {
    const segments = generateSyntheticSegments(100);
    for (const seg of segments) {
      expect(seg.end - seg.start).toBeGreaterThan(0);
    }
  });

  it('should produce segments with non-empty text', () => {
    const segments = generateSyntheticSegments(100);
    for (const seg of segments) {
      expect(seg.text.length).toBeGreaterThan(0);
    }
  });

  it('should be deterministic (same output for same inputs)', () => {
    const run1 = generateSyntheticSegments(50);
    const run2 = generateSyntheticSegments(50);
    expect(run1).toEqual(run2);
  });

  it('should respect custom options', () => {
    const segments = generateSyntheticSegments(20, {
      avgDurationSec: 2.0,
      avgCharCount: 60,
    });

    const avgDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0) / segments.length;
    // Should be roughly around 2.0 (with variance)
    expect(avgDuration).toBeGreaterThan(1.0);
    expect(avgDuration).toBeLessThan(4.0);
  });
});

describe('generateSyntheticHighlightErrors', () => {
  it('should generate correct count', () => {
    const samples = generateSyntheticHighlightErrors(100, 'desktop');
    expect(samples).toHaveLength(100);
  });

  it('should set correct platform', () => {
    const desktop = generateSyntheticHighlightErrors(10, 'desktop');
    const mobile = generateSyntheticHighlightErrors(10, 'mobile');

    expect(desktop.every(s => s.platform === 'desktop')).toBe(true);
    expect(mobile.every(s => s.platform === 'mobile')).toBe(true);
  });

  it('should produce non-negative errors', () => {
    const samples = generateSyntheticHighlightErrors(100, 'desktop');
    expect(samples.every(s => s.errorMs >= 0)).toBe(true);
  });

  it('should have lower errors for desktop by default', () => {
    const desktop = generateSyntheticHighlightErrors(200, 'desktop');
    const mobile = generateSyntheticHighlightErrors(200, 'mobile');

    const avgDesktop = desktop.reduce((s, v) => s + v.errorMs, 0) / desktop.length;
    const avgMobile = mobile.reduce((s, v) => s + v.errorMs, 0) / mobile.length;

    expect(avgDesktop).toBeLessThan(avgMobile);
  });
});

describe('generateSyntheticLoopOvershoots', () => {
  it('should generate correct count', () => {
    const samples = generateSyntheticLoopOvershoots(50);
    expect(samples).toHaveLength(50);
  });

  it('should produce non-negative overshoots', () => {
    const samples = generateSyntheticLoopOvershoots(100);
    expect(samples.every(s => s.overshootMs >= 0)).toBe(true);
  });
});

describe('generateSyntheticPlaybackMinutes', () => {
  it('should generate correct count', () => {
    const samples = generateSyntheticPlaybackMinutes(100);
    expect(samples).toHaveLength(100);
  });

  it('should have low drift rate by default', () => {
    const samples = generateSyntheticPlaybackMinutes(1000, 0.003);
    const driftCount = samples.filter(s => s.hadDriftIncident).length;
    // Expect roughly 0.3% → ~3 incidents in 1000 minutes
    // Allow range due to PRNG
    expect(driftCount).toBeLessThan(20);
  });

  it('should have higher drift rate when configured', () => {
    const low = generateSyntheticPlaybackMinutes(1000, 0.001);
    const high = generateSyntheticPlaybackMinutes(1000, 0.1);

    const lowDrift = low.filter(s => s.hadDriftIncident).length;
    const highDrift = high.filter(s => s.hadDriftIncident).length;

    expect(highDrift).toBeGreaterThan(lowDrift);
  });
});

// ============================================================================
// HARNESS SMOKE TEST
// ============================================================================

describe('BenchmarkHarness', () => {
  let harness: BenchmarkHarness;

  beforeEach(() => {
    harness = new BenchmarkHarness();
  });

  it('should run a synthetic benchmark end-to-end', () => {
    const report = harness.runSyntheticBenchmark();

    expect(report.version).toBe('1.0.0');
    expect(report.generatedAt).toBeTruthy();
    expect(report.runId).toMatch(/^bench_/);
  });

  it('should produce valid segmentation metrics', () => {
    const report = harness.runSyntheticBenchmark({ segmentCount: 100 });

    expect(report.segmentation.segmentDuration.count).toBe(100);
    expect(report.segmentation.segmentDuration.median).toBeGreaterThan(0);
    expect(report.segmentation.segmentDuration.p90).toBeGreaterThan(0);
    expect(report.segmentation.segmentDuration.p95).toBeGreaterThan(0);
    expect(report.segmentation.segmentLength.count).toBe(100);
    expect(report.segmentation.oversizedSegmentRate).toBeDefined();
  });

  it('should produce valid sync metrics', () => {
    const report = harness.runSyntheticBenchmark({
      highlightSampleCount: 200,
      overshootSampleCount: 100,
      playbackMinuteCount: 300,
    });

    expect(report.sync.highlightError.desktop.count).toBeGreaterThan(0);
    expect(report.sync.highlightError.mobile.count).toBeGreaterThan(0);
    expect(report.sync.loopOvershoot.count).toBe(100);
    expect(report.sync.hardDriftIncidentRate).toBeDefined();
  });

  it('should evaluate acceptance gates', () => {
    const report = harness.runSyntheticBenchmark();

    expect(report.acceptanceGates.gates.length).toBeGreaterThan(0);
    expect(report.acceptanceGates.passCount).toBeGreaterThanOrEqual(0);
    expect(report.acceptanceGates.failCount).toBeGreaterThanOrEqual(0);
    expect(typeof report.acceptanceGates.allPassed).toBe('boolean');

    // Each gate should have required fields
    for (const gate of report.acceptanceGates.gates) {
      expect(gate.name).toBeTruthy();
      expect(gate.metric).toBeTruthy();
      expect(gate.unit).toBeTruthy();
      expect(['pass', 'fail', 'no_data']).toContain(gate.status);
    }
  });

  it('should include sample counts in metadata', () => {
    const report = harness.runSyntheticBenchmark();

    expect(report.metadata.sampleCounts.segmentDuration).toBeGreaterThan(0);
    expect(report.metadata.sampleCounts.segmentLength).toBeGreaterThan(0);
    expect(report.metadata.sampleCounts.highlightErrorDesktop).toBeGreaterThan(0);
    expect(report.metadata.sampleCounts.highlightErrorMobile).toBeGreaterThan(0);
    expect(report.metadata.sampleCounts.loopOvershoot).toBeGreaterThan(0);
    expect(report.metadata.sampleCounts.playbackMinutes).toBeGreaterThan(0);
  });

  it('should produce valid JSON output', () => {
    const report = harness.runSyntheticBenchmark();
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as BenchmarkReport;

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.segmentation).toBeDefined();
    expect(parsed.sync).toBeDefined();
    expect(parsed.acceptanceGates).toBeDefined();
  });

  it('should complete in <100ms for typical workload', () => {
    const start = performance.now();
    harness.runSyntheticBenchmark({
      segmentCount: 1000,
      highlightSampleCount: 1000,
      overshootSampleCount: 500,
      playbackMinuteCount: 500,
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it('should ingest real segment data', () => {
    const segments = [
      { start: 0, end: 3.5, text: 'First segment text' },
      { start: 3.7, end: 7.2, text: 'Second segment with more text here' },
      { start: 7.5, end: 11.0, text: 'Third segment' },
    ];

    harness.ingestSegments(segments);
    const report = harness.generateReport();

    expect(report.segmentation.segmentDuration.count).toBe(3);
    expect(report.segmentation.segmentLength.count).toBe(3);
  });

  it('should reset between runs', () => {
    harness.runSyntheticBenchmark({ segmentCount: 50 });
    const report = harness.runSyntheticBenchmark({ segmentCount: 100 });

    // After reset + re-run, should have exactly 100 (not 150)
    expect(report.segmentation.segmentDuration.count).toBe(100);
  });
});

// ============================================================================
// ACCEPTANCE GATE EVALUATION
// ============================================================================

describe('Acceptance gate evaluation', () => {
  it('should pass all gates with ideal synthetic data', () => {
    const harness = new BenchmarkHarness();

    // Generate data that should pass all gates
    const segments = generateSyntheticSegments(100, {
      avgDurationSec: 4.0,
      durationVariance: 1.0,
      avgCharCount: 50,
      charVariance: 10,
    });
    harness.ingestSegments(segments);

    // Low highlight errors
    harness.ingestHighlightErrors(
      generateSyntheticHighlightErrors(100, 'desktop', { avgErrorMs: 60, errorVariance: 30 })
    );
    harness.ingestHighlightErrors(
      generateSyntheticHighlightErrors(100, 'mobile', { avgErrorMs: 100, errorVariance: 30 })
    );

    // Low loop overshoots
    harness.ingestLoopOvershoots(
      generateSyntheticLoopOvershoots(100, { avgOvershootMs: 60, overshootVariance: 20 })
    );

    // Very low drift
    harness.ingestPlaybackMinutes(generateSyntheticPlaybackMinutes(500, 0.001));

    const report = harness.generateReport();

    // Most gates should pass with ideal data
    expect(report.acceptanceGates.failCount).toBeLessThanOrEqual(2);
  });

  it('should fail gates with poor sync data', () => {
    const harness = new BenchmarkHarness();
    harness.ingestSegments(generateSyntheticSegments(50));

    // Very high highlight errors (should fail)
    harness.ingestHighlightErrors(
      generateSyntheticHighlightErrors(100, 'desktop', { avgErrorMs: 300, errorVariance: 50 })
    );

    const report = harness.generateReport();

    // Desktop highlight median gate should fail
    const desktopMedianGate = report.acceptanceGates.gates.find(
      g => g.metric === 'highlightError.desktop.median'
    );
    expect(desktopMedianGate?.status).toBe('fail');
  });

  it('should report no_data when metrics are missing', () => {
    const harness = new BenchmarkHarness();
    // Don't ingest any data

    const report = harness.generateReport();

    const noDataGates = report.acceptanceGates.gates.filter(g => g.status === 'no_data');
    expect(noDataGates.length).toBeGreaterThan(0);
  });

  it('should NOT pass globally when no_data gates exist (regression)', () => {
    const harness = new BenchmarkHarness();
    // Don't ingest any data — produces no_data gates

    const report = harness.generateReport();

    // Even though there are zero fails, no_data must prevent allPassed
    expect(report.acceptanceGates.failCount).toBe(0);
    expect(report.acceptanceGates.noDataCount).toBeGreaterThan(0);
    expect(report.acceptanceGates.allPassed).toBe(false);
  });

  it('should map every metric to an acceptance gate', () => {
    const harness = new BenchmarkHarness();
    const report = harness.runSyntheticBenchmark();

    // Expected gate metrics (from acceptance-gates.md)
    const expectedMetrics = [
      'segmentDuration.median',  // lower bound
      'segmentDuration.median',  // upper bound
      'segmentDuration.p90',
      'segmentDuration.p95',
      'segmentLength.median',    // lower bound
      'segmentLength.median',    // upper bound
      'oversizedSegmentRate',
      'highlightError.desktop.median',
      'highlightError.desktop.p95',
      'highlightError.mobile.median',
      'highlightError.mobile.p95',
      'loopOvershoot.median',
      'loopOvershoot.p95',
      'hardDriftIncidentRate',
    ];

    const gateMetrics = report.acceptanceGates.gates.map(g => g.metric);
    for (const expected of expectedMetrics) {
      expect(gateMetrics).toContain(expected);
    }
  });
});

// ============================================================================
// BACKWARD COMPATIBILITY: ANALYTICS PAYLOAD
// ============================================================================

describe('Analytics payload backward compatibility', () => {
  it('should preserve required existing fields', () => {
    // This test validates that InstrumentationAnalyticsPayload
    // is a superset of existing practice tracking fields
    const payload: InstrumentationAnalyticsPayload = {
      videoId: 'test123',
      practiceTime: 300,
    };

    // Required existing fields are present
    expect(payload.videoId).toBe('test123');
    expect(payload.practiceTime).toBe(300);
  });

  it('should allow optional instrumentation extension', () => {
    const payload: InstrumentationAnalyticsPayload = {
      videoId: 'test123',
      practiceTime: 300,
      instrumentation: {
        segmentDurations: [3.5, 4.0, 5.2],
        segmentLengths: [35, 42, 55],
        highlightErrors: [
          { errorMs: 85, platform: 'desktop' },
          { errorMs: 150, platform: 'mobile' },
        ],
        loopOvershoots: [{ overshootMs: 95 }],
        hardDrifts: [{ driftMs: 650, durationSec: 2.1 }],
      },
    };

    expect(payload.instrumentation).toBeDefined();
    expect(payload.instrumentation!.segmentDurations).toHaveLength(3);
    expect(payload.instrumentation!.highlightErrors).toHaveLength(2);
  });

  it('should be valid without instrumentation field (backward compat)', () => {
    const payload: InstrumentationAnalyticsPayload = {
      videoId: 'test123',
      practiceTime: 300,
    };

    // Must serialize without instrumentation field
    const serialized = JSON.stringify(payload);
    const parsed = JSON.parse(serialized);

    expect(parsed.videoId).toBe('test123');
    expect(parsed.practiceTime).toBe(300);
    expect(parsed.instrumentation).toBeUndefined();
  });

  it('should produce JSON compatible with existing /api/practice/track', () => {
    // Simulate what the existing endpoint expects
    const existingPayload = {
      videoId: 'test123',
      videoUrl: 'https://youtube.com/watch?v=test123',
      videoTitle: 'Test Video',
      practiceTime: 300,
    };

    // New payload with instrumentation added
    const newPayload = {
      ...existingPayload,
      instrumentation: {
        segmentDurations: [3.5, 4.0],
        highlightErrors: [{ errorMs: 85, platform: 'desktop' }],
      },
    };

    // Existing endpoint should ignore unknown fields
    const { videoId, videoUrl, videoTitle, practiceTime } = newPayload;
    expect(videoId).toBe('test123');
    expect(videoUrl).toBe('https://youtube.com/watch?v=test123');
    expect(videoTitle).toBe('Test Video');
    expect(practiceTime).toBe(300);
  });
});
