/**
 * Unit tests for verifySeekLanding (SYNC_PRECISION_V2)
 *
 * Tests cover:
 * - Seek landing within threshold (accept)
 * - Seek landing exceeding threshold (re-seek + correct)
 * - Max attempts exhausted (fail gracefully)
 * - Invalid player (handle null)
 * - Custom threshold
 * - Timing metrics
 * - Boundary buffer integration (short vs long segments, playback rate scaling)
 */

import {
  verifySeekLanding,
  calculateSegmentBuffers,
  debugLogger,
} from '../youtubePlayerUtils';

// Silence debug logger for test output cleanliness (no module mock needed)
beforeAll(() => {
  debugLogger.updateConfig({
    enableSeekPerformance: false,
    enableSegmentDetection: false,
    enableBufferPreload: false,
  });
});

function createMockPlayer(timeSequence: number[]) {
  let callIndex = 0;
  return {
    seekTo: jest.fn(),
    getCurrentTime: jest.fn(() => {
      const time = timeSequence[callIndex] ?? timeSequence[timeSequence.length - 1];
      callIndex++;
      return time;
    }),
    playVideo: jest.fn(),
    getPlayerState: jest.fn(() => 1),
  };
}

describe('verifySeekLanding', () => {
  // Use real timers with settleMs=1 for fast execution

  it('should accept seek landing within threshold', async () => {
    const player = createMockPlayer([10.05]); // 0.05s error < 0.15s threshold

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.success).toBe(true);
    expect(result.targetTime).toBe(10.0);
    expect(result.error).toBeCloseTo(0.05, 2);
    expect(result.correctionAttempts).toBe(0);
    expect(player.seekTo).not.toHaveBeenCalled();
  });

  it('should re-seek when landing exceeds threshold', async () => {
    // First read: off by 0.5s (exceeds 0.15s threshold)
    // After correction: close enough
    const player = createMockPlayer([10.5, 10.1]);

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.success).toBe(true);
    expect(result.correctionAttempts).toBe(1);
    expect(player.seekTo).toHaveBeenCalledWith(10.0, true);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });

  it('should exhaust max corrections and fail gracefully', async () => {
    // Player always reports bad position
    const player = createMockPlayer([15.0, 14.5, 14.0]); // All far from 10.0

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1, maxCorrections: 2 });

    expect(result.success).toBe(false);
    expect(result.correctionAttempts).toBe(2);
    expect(result.error).toBeGreaterThan(0.15);
    expect(player.seekTo).toHaveBeenCalledTimes(2);
  });

  it('should handle invalid player (null)', async () => {
    const result = await verifySeekLanding(null, 10.0, { settleMs: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toBe(Infinity);
    expect(result.correctionAttempts).toBe(0);
  });

  it('should handle player with missing getCurrentTime', async () => {
    const player = { seekTo: jest.fn() };

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toBe(Infinity);
  });

  it('should handle player with missing seekTo', async () => {
    const player = { getCurrentTime: jest.fn(() => 10.0) };

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toBe(Infinity);
  });

  it('should respect custom threshold', async () => {
    // Error of 0.3s: fails at 0.15 default, passes at 0.5 custom
    const player = createMockPlayer([10.3]);

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1, threshold: 0.5 });

    expect(result.success).toBe(true);
    expect(result.error).toBeCloseTo(0.3, 2);
    expect(result.correctionAttempts).toBe(0);
  });

  it('should report timing metrics', async () => {
    const player = createMockPlayer([10.05]);

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.totalMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.totalMs).toBe('number');
  });

  it('should handle exact landing (zero error)', async () => {
    const player = createMockPlayer([10.0]);

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.success).toBe(true);
    expect(result.error).toBe(0);
    expect(result.correctionAttempts).toBe(0);
  });

  it('should handle seek to time zero', async () => {
    const player = createMockPlayer([0.02]);

    const result = await verifySeekLanding(player, 0, { settleMs: 1 });

    expect(result.success).toBe(true);
    expect(result.targetTime).toBe(0);
  });

  it('should use default maxCorrections of 2', async () => {
    // Player always off - should only try 2 corrections by default
    const player = createMockPlayer([20.0, 19.0, 18.0, 17.0]);

    const result = await verifySeekLanding(player, 10.0, { settleMs: 1 });

    expect(result.correctionAttempts).toBe(2);
    expect(player.seekTo).toHaveBeenCalledTimes(2);
  });
});

describe('Boundary buffer integration with calculateSegmentBuffers', () => {
  it('should provide tighter buffer for short segments', () => {
    const shortBuffers = calculateSegmentBuffers(0.5, 1.0);
    const longBuffers = calculateSegmentBuffers(10.0, 1.0);

    // Short segments need proportionally smaller trigger buffer
    expect(shortBuffers.triggerBuffer).toBeLessThanOrEqual(longBuffers.triggerBuffer);
  });

  it('should provide looser detection buffer than trigger buffer', () => {
    const { detectionBuffer, triggerBuffer } = calculateSegmentBuffers(3.0, 1.0);

    expect(detectionBuffer).toBeGreaterThan(triggerBuffer);
  });

  it('should scale buffers with playback rate', () => {
    const normal = calculateSegmentBuffers(5.0, 1.0);
    const fast = calculateSegmentBuffers(5.0, 2.0);

    // Faster playback = smaller real-time buffers
    expect(fast.triggerBuffer).toBeLessThan(normal.triggerBuffer);
    expect(fast.detectionBuffer).toBeLessThan(normal.detectionBuffer);
  });

  it('should handle very short segments without going negative', () => {
    const { triggerBuffer, detectionBuffer } = calculateSegmentBuffers(0.1, 1.0);

    expect(triggerBuffer).toBeGreaterThan(0);
    expect(detectionBuffer).toBeGreaterThan(0);
  });

  it('should handle slow playback rate', () => {
    const { triggerBuffer } = calculateSegmentBuffers(5.0, 0.5);

    // Slower playback = larger real-time buffer
    expect(triggerBuffer).toBeGreaterThan(0);
  });
});
