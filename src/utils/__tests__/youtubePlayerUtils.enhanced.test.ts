/**
 * Unit tests for YouTube Player Utilities - Enhanced Features
 *
 * Tests cover:
 * - Frame-aware buffer calculations
 * - Two-tier detection system
 * - Seek request queue with debouncing
 */

import {
  calculateFrameAwareBuffer,
  calculateSegmentBuffers,
  SeekRequestQueue,
  DebugLogger,
} from '../youtubePlayerUtils';

describe('Frame-Aware Buffer Calculations', () => {
  describe('calculateFrameAwareBuffer', () => {
    it('should use frame-based minimum for short segments', () => {
      // 0.3s segment @ 30fps → 2 frames = 0.066s
      const buffer = calculateFrameAwareBuffer(0.3, 1.0, {
        videoFrameRate: 30,
        minFrameBuffer: 2,
        segmentLookaheadRatio: 0.02
      });

      expect(buffer).toBeGreaterThanOrEqual(0.066);
      expect(buffer).toBeLessThan(0.1); // Better than old 0.1s minimum
    });

    it('should use segment ratio for longer segments', () => {
      // 5s segment @ 30fps, 2% ratio = 0.1s
      const buffer = calculateFrameAwareBuffer(5.0, 1.0, {
        videoFrameRate: 30,
        minFrameBuffer: 2,
        segmentLookaheadRatio: 0.02
      });

      expect(buffer).toBeCloseTo(0.1, 2);
    });

    it('should adjust for playback rate', () => {
      // 2s segment @ 30fps, 2x speed
      const buffer1x = calculateFrameAwareBuffer(2.0, 1.0, {
        videoFrameRate: 30,
        segmentLookaheadRatio: 0.02
      });

      const buffer2x = calculateFrameAwareBuffer(2.0, 2.0, {
        videoFrameRate: 30,
        segmentLookaheadRatio: 0.02
      });

      // 2x playback should have smaller real-time buffer
      expect(buffer2x).toBeLessThan(buffer1x);
    });

    it('should adapt to different framerates', () => {
      // 0.5s segment @ 60fps vs 30fps
      const buffer60fps = calculateFrameAwareBuffer(0.5, 1.0, {
        videoFrameRate: 60,
        minFrameBuffer: 2
      });

      const buffer30fps = calculateFrameAwareBuffer(0.5, 1.0, {
        videoFrameRate: 30,
        minFrameBuffer: 2
      });

      // 60fps has tighter frame buffer (0.033s vs 0.066s)
      expect(buffer60fps).toBeLessThan(buffer30fps);
    });

    it('should respect absolute minimum', () => {
      // Extremely short segment
      const buffer = calculateFrameAwareBuffer(0.01, 1.0, {
        videoFrameRate: 30,
        absoluteMinSec: 0.033
      });

      expect(buffer).toBeGreaterThanOrEqual(0.033);
    });

    it('should respect absolute maximum', () => {
      // Very long segment
      const buffer = calculateFrameAwareBuffer(100, 1.0, {
        videoFrameRate: 30,
        segmentLookaheadRatio: 0.1,
        absoluteMaxSec: 0.5
      });

      expect(buffer).toBeLessThanOrEqual(0.5);
    });

    it('should handle invalid inputs gracefully', () => {
      expect(calculateFrameAwareBuffer(0, 1.0)).toBeGreaterThan(0);
      expect(calculateFrameAwareBuffer(-1, 1.0)).toBeGreaterThan(0);
      expect(calculateFrameAwareBuffer(5.0, 0)).toBeGreaterThan(0);
      expect(calculateFrameAwareBuffer(5.0, -1)).toBeGreaterThan(0);
    });
  });

  describe('calculateSegmentBuffers (Two-Tier System)', () => {
    it('should provide looser detection buffer than trigger buffer', () => {
      const { detectionBuffer, triggerBuffer } = calculateSegmentBuffers(
        2.5,
        1.0,
        30
      );

      // Detection (5%) should be larger than trigger (2%)
      expect(detectionBuffer).toBeGreaterThan(triggerBuffer);
    });

    it('should have appropriate ratios for typical segment', () => {
      const { detectionBuffer, triggerBuffer } = calculateSegmentBuffers(
        2.0,
        1.0,
        30
      );

      // Detection: ~5% of 2s = 0.1s
      expect(detectionBuffer).toBeCloseTo(0.1, 1);

      // Trigger: ~2% of 2s = 0.04s
      expect(triggerBuffer).toBeCloseTo(0.04, 1);
    });

    it('should scale with playback rate', () => {
      const buffers1x = calculateSegmentBuffers(2.0, 1.0, 30);
      const buffers2x = calculateSegmentBuffers(2.0, 2.0, 30);

      expect(buffers2x.detectionBuffer).toBeLessThan(buffers1x.detectionBuffer);
      expect(buffers2x.triggerBuffer).toBeLessThan(buffers1x.triggerBuffer);
    });
  });
});

describe('Seek Request Queue', () => {
  let mockPlayer: any;
  let queue: SeekRequestQueue;

  beforeEach(() => {
    mockPlayer = {
      seekTo: jest.fn(),
      getPlayerState: jest.fn(() => 2), // PAUSED
    };

    queue = new SeekRequestQueue({
      debounceWindow: 50,
      coalesceTolerance: 0.5
    });
  });

  it('should process single seek request', async () => {
    const result = await queue.enqueue(mockPlayer, 10.5, {
      maxWaitMs: 100
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(10.5, true);
    expect(result.success).toBe(true);
  });

  it('should coalesce nearby seeks', async () => {
    // Queue two seeks to nearby positions
    const promise1 = queue.enqueue(mockPlayer, 10.0, {});
    const promise2 = queue.enqueue(mockPlayer, 10.3, {}); // Within 0.5s tolerance

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Should only call seekTo once (coalesced)
    expect(mockPlayer.seekTo).toHaveBeenCalledTimes(1);
    expect(result2.wasCoalesced).toBe(true);
  });

  it('should NOT coalesce distant seeks', async () => {
    const promise1 = queue.enqueue(mockPlayer, 10.0, {});
    const promise2 = queue.enqueue(mockPlayer, 20.0, {}); // > 0.5s apart

    await Promise.all([promise1, promise2]);

    // Should call seekTo twice (not coalesced)
    expect(mockPlayer.seekTo).toHaveBeenCalledTimes(2);
  });

  it('should prioritize high priority seeks', async () => {
    const seeks: number[] = [];

    // Override seekTo to track order
    mockPlayer.seekTo = jest.fn((time: number) => {
      seeks.push(time);
    });

    // Queue in order: low, normal, high
    queue.enqueue(mockPlayer, 10.0, { priority: 'low' });
    queue.enqueue(mockPlayer, 20.0, { priority: 'normal' });
    queue.enqueue(mockPlayer, 30.0, { priority: 'high' });

    await new Promise(resolve => setTimeout(resolve, 200));

    // Should execute in priority order: high (30), normal (20), low (10)
    expect(seeks[0]).toBe(30.0);
    expect(seeks[1]).toBe(20.0);
    expect(seeks[2]).toBe(10.0);
  });

  it('should cancel all queued requests', async () => {
    const promise1 = queue.enqueue(mockPlayer, 10.0, {});
    const promise2 = queue.enqueue(mockPlayer, 20.0, {});

    queue.cancelAll();

    await expect(promise1).rejects.toThrow('Seek cancelled');
    await expect(promise2).rejects.toThrow('Seek cancelled');
  });

  it('should provide queue statistics', () => {
    queue.enqueue(mockPlayer, 10.0, {});
    queue.enqueue(mockPlayer, 20.0, {});

    const stats = queue.getStats();

    expect(stats.queueLength).toBeGreaterThan(0);
    expect(stats.isProcessing).toBeDefined();
  });
});

describe('Debug Logger', () => {
  let logger: DebugLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    logger = new DebugLogger({
      enableSegmentDetection: false,
      enableSeekPerformance: false,
      enableBufferPreload: false
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should NOT log when disabled', () => {
    logger.segmentDetection('test message');
    logger.seekPerformance('test message');
    logger.bufferPreload('test message');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('should log segment detection when enabled', () => {
    logger.updateConfig({ enableSegmentDetection: true });

    logger.segmentDetection('test message', 123);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SegmentDetection] test message',
      123
    );
  });

  it('should log seek performance when enabled', () => {
    logger.updateConfig({ enableSeekPerformance: true });

    logger.seekPerformance('slow seek', 1500);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[SeekPerf] slow seek',
      1500
    );
  });

  it('should log buffer preload when enabled', () => {
    logger.updateConfig({ enableBufferPreload: true });

    logger.bufferPreload('preloading segment', 5);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[BufferPreload] preloading segment',
      5
    );
  });

  it('should support selective logging', () => {
    logger.updateConfig({
      enableSegmentDetection: true,
      enableSeekPerformance: false
    });

    logger.segmentDetection('should log');
    logger.seekPerformance('should NOT log');

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SegmentDetection] should log'
    );
  });
});
