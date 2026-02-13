/**
 * Tests for metric collectors.
 *
 * Covers:
 * - SegmentDurationCollector
 * - SegmentLengthCollector
 * - HighlightErrorCollector
 * - LoopOvershootCollector
 * - HardDriftCollector
 * - InstrumentationCollector (facade)
 */

import {
  SegmentDurationCollector,
  SegmentLengthCollector,
  HighlightErrorCollector,
  LoopOvershootCollector,
  HardDriftCollector,
  InstrumentationCollector,
} from '../collectors';

describe('SegmentDurationCollector', () => {
  let collector: SegmentDurationCollector;

  beforeEach(() => {
    collector = new SegmentDurationCollector();
  });

  it('should start with 0 samples', () => {
    expect(collector.getSampleCount()).toBe(0);
  });

  it('should record individual samples', () => {
    collector.record({ segmentIndex: 0, durationSec: 3.5 });
    collector.record({ segmentIndex: 1, durationSec: 4.2 });

    expect(collector.getSampleCount()).toBe(2);
  });

  it('should record batch from segment objects', () => {
    const segments = [
      { start: 0, end: 3.5 },
      { start: 3.7, end: 7.9 },
      { start: 8.1, end: 12.0 },
    ];

    collector.recordBatch(segments);
    expect(collector.getSampleCount()).toBe(3);

    const result = collector.getResult();
    expect(result.min).toBeCloseTo(3.5, 1);
    expect(result.max).toBeCloseTo(4.2, 1);
  });

  it('should compute percentiles correctly', () => {
    const durations = [2.0, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 7.0, 8.0];
    for (let i = 0; i < durations.length; i++) {
      collector.record({ segmentIndex: i, durationSec: durations[i] });
    }

    const result = collector.getResult();
    expect(result.median).toBeCloseTo(4.75, 1);
    expect(result.count).toBe(10);
  });

  it('should calculate oversized rate', () => {
    // 2 segments > 12s out of 10
    const durations = [3, 4, 5, 6, 7, 8, 9, 10, 13, 15];
    for (let i = 0; i < durations.length; i++) {
      collector.record({ segmentIndex: i, durationSec: durations[i] });
    }

    expect(collector.getOversizedRate()).toBeCloseTo(0.2, 5);
  });

  it('should reset correctly', () => {
    collector.record({ segmentIndex: 0, durationSec: 5.0 });
    collector.reset();

    expect(collector.getSampleCount()).toBe(0);
    expect(collector.getResult().count).toBe(0);
  });
});

describe('SegmentLengthCollector', () => {
  let collector: SegmentLengthCollector;

  beforeEach(() => {
    collector = new SegmentLengthCollector();
  });

  it('should record individual samples', () => {
    collector.record({ segmentIndex: 0, charCount: 35 });
    collector.record({ segmentIndex: 1, charCount: 42 });

    expect(collector.getSampleCount()).toBe(2);
  });

  it('should record batch from text segments', () => {
    const segments = [
      { text: 'Short text' },
      { text: 'A medium length text segment here' },
      { text: '  trimmed  ' },
    ];

    collector.recordBatch(segments);
    expect(collector.getSampleCount()).toBe(3);

    const result = collector.getResult();
    // 'trimmed' = 7 chars after trim
    expect(result.min).toBe(7);
  });

  it('should compute percentiles correctly', () => {
    for (let i = 0; i < 100; i++) {
      collector.record({ segmentIndex: i, charCount: 30 + i });
    }

    const result = collector.getResult();
    expect(result.median).toBeCloseTo(79.5, 1);
    expect(result.count).toBe(100);
  });
});

describe('HighlightErrorCollector', () => {
  let collector: HighlightErrorCollector;

  beforeEach(() => {
    collector = new HighlightErrorCollector();
  });

  it('should separate desktop and mobile samples', () => {
    collector.record({ segmentIndex: 0, errorMs: 85, timestamp: Date.now(), platform: 'desktop' });
    collector.record({ segmentIndex: 1, errorMs: 150, timestamp: Date.now(), platform: 'mobile' });
    collector.record({ segmentIndex: 2, errorMs: 90, timestamp: Date.now(), platform: 'desktop' });

    expect(collector.getDesktopSampleCount()).toBe(2);
    expect(collector.getMobileSampleCount()).toBe(1);
    expect(collector.getSampleCount()).toBe(3);
  });

  it('should compute separate percentiles for each platform', () => {
    // Desktop samples: low errors
    for (let i = 0; i < 50; i++) {
      collector.record({
        segmentIndex: i,
        errorMs: 60 + i * 2,
        timestamp: Date.now(),
        platform: 'desktop',
      });
    }

    // Mobile samples: higher errors
    for (let i = 0; i < 50; i++) {
      collector.record({
        segmentIndex: i,
        errorMs: 100 + i * 3,
        timestamp: Date.now(),
        platform: 'mobile',
      });
    }

    const result = collector.getResult();
    expect(result.desktop.median).toBeLessThan(result.mobile.median);
    expect(result.desktop.p95).toBeLessThan(result.mobile.p95);
  });

  it('should handle empty platform data', () => {
    collector.record({ segmentIndex: 0, errorMs: 85, timestamp: Date.now(), platform: 'desktop' });

    const result = collector.getResult();
    expect(result.desktop.count).toBe(1);
    expect(result.mobile.count).toBe(0);
  });
});

describe('LoopOvershootCollector', () => {
  let collector: LoopOvershootCollector;

  beforeEach(() => {
    collector = new LoopOvershootCollector();
  });

  it('should record and compute percentiles', () => {
    const overshoots = [50, 60, 70, 80, 90, 100, 110, 120, 180, 250];
    for (let i = 0; i < overshoots.length; i++) {
      collector.record({
        segmentIndex: i,
        overshootMs: overshoots[i],
        repeatNumber: 1,
        timestamp: Date.now(),
      });
    }

    const result = collector.getResult();
    expect(result.count).toBe(10);
    expect(result.median).toBeCloseTo(95, 1);
    expect(result.p95).toBeGreaterThan(200);
  });
});

describe('HardDriftCollector', () => {
  let collector: HardDriftCollector;

  beforeEach(() => {
    collector = new HardDriftCollector();
  });

  it('should calculate incident rate from playback minutes', () => {
    // 2 drift incidents in 100 playback minutes = 2%
    for (let i = 0; i < 100; i++) {
      collector.recordPlaybackMinute({
        minuteIndex: i,
        hadDriftIncident: i === 10 || i === 50,
      });
    }

    expect(collector.getResult()).toBeCloseTo(0.02, 5);
    expect(collector.getSampleCount()).toBe(100);
  });

  it('should track drift details separately', () => {
    collector.recordDrift({
      segmentIndex: 5,
      driftMs: 650,
      driftDurationSec: 2.1,
      timestamp: Date.now(),
    });

    expect(collector.getDriftCount()).toBe(1);
    expect(collector.getDriftDetails()).toHaveLength(1);
    expect(collector.getDriftDetails()[0].driftMs).toBe(650);
  });

  it('should return 0 rate when no playback minutes', () => {
    expect(collector.getResult()).toBe(0);
  });

  it('should return 0 rate when no incidents', () => {
    for (let i = 0; i < 50; i++) {
      collector.recordPlaybackMinute({ minuteIndex: i, hadDriftIncident: false });
    }

    expect(collector.getResult()).toBe(0);
  });
});

describe('InstrumentationCollector (facade)', () => {
  let collector: InstrumentationCollector;

  beforeEach(() => {
    collector = new InstrumentationCollector();
  });

  it('should provide access to all sub-collectors', () => {
    expect(collector.segmentDuration).toBeInstanceOf(SegmentDurationCollector);
    expect(collector.segmentLength).toBeInstanceOf(SegmentLengthCollector);
    expect(collector.highlightError).toBeInstanceOf(HighlightErrorCollector);
    expect(collector.loopOvershoot).toBeInstanceOf(LoopOvershootCollector);
    expect(collector.hardDrift).toBeInstanceOf(HardDriftCollector);
  });

  it('should produce segmentation metrics', () => {
    const segments = [
      { start: 0, end: 3, text: 'Short' },
      { start: 3.2, end: 7.5, text: 'Medium length segment text' },
      { start: 7.7, end: 12.0, text: 'Another medium segment text here' },
    ];

    collector.segmentDuration.recordBatch(segments);
    collector.segmentLength.recordBatch(segments);

    const metrics = collector.getSegmentationMetrics();
    expect(metrics.segmentDuration.count).toBe(3);
    expect(metrics.segmentLength.count).toBe(3);
    expect(metrics.oversizedSegmentRate).toBeDefined();
  });

  it('should produce sync metrics', () => {
    collector.highlightError.record({
      segmentIndex: 0,
      errorMs: 85,
      timestamp: Date.now(),
      platform: 'desktop',
    });

    collector.loopOvershoot.record({
      segmentIndex: 0,
      overshootMs: 95,
      repeatNumber: 1,
      timestamp: Date.now(),
    });

    collector.hardDrift.recordPlaybackMinute({
      minuteIndex: 0,
      hadDriftIncident: false,
    });

    const metrics = collector.getSyncMetrics();
    expect(metrics.highlightError.desktop.count).toBe(1);
    expect(metrics.loopOvershoot.count).toBe(1);
    expect(metrics.hardDriftIncidentRate).toBe(0);
  });

  it('should report sample counts', () => {
    collector.segmentDuration.record({ segmentIndex: 0, durationSec: 3 });
    collector.highlightError.record({
      segmentIndex: 0,
      errorMs: 85,
      timestamp: Date.now(),
      platform: 'mobile',
    });

    const counts = collector.getSampleCounts();
    expect(counts.segmentDuration).toBe(1);
    expect(counts.highlightErrorDesktop).toBe(0);
    expect(counts.highlightErrorMobile).toBe(1);
  });

  it('should reset all collectors', () => {
    collector.segmentDuration.record({ segmentIndex: 0, durationSec: 3 });
    collector.segmentLength.record({ segmentIndex: 0, charCount: 30 });
    collector.highlightError.record({
      segmentIndex: 0,
      errorMs: 85,
      timestamp: Date.now(),
      platform: 'desktop',
    });

    collector.resetAll();

    const counts = collector.getSampleCounts();
    expect(counts.segmentDuration).toBe(0);
    expect(counts.segmentLength).toBe(0);
    expect(counts.highlightErrorDesktop).toBe(0);
  });
});
