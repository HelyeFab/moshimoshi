/**
 * YouTube Player Utilities
 *
 * Advanced utility functions for YouTube IFrame API integration,
 * optimizing seek operations, buffering, and segment detection.
 */

import { YouTubePlayerStateEnum } from '@/types/youtube-player';

// ============================================================================
// SMART SEEK WITH BUFFERING DETECTION (Issue 1)
// ============================================================================

export interface SeekOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  onProgress?: (elapsedMs: number) => void;
}

export interface SeekResult {
  success: boolean;
  waitedMs: number;
}

/**
 * Seeks to a position and waits for the player to be ready.
 *
 * This solves the nested timeout issue by polling the player state
 * instead of using a fixed delay. Works around YouTube IFrame API's
 * asynchronous buffering behavior.
 *
 * @param player - YouTube IFrame player instance
 * @param targetTime - Time to seek to in seconds
 * @param options - Configuration options
 * @returns Promise resolving to seek result with timing info
 *
 * @example
 * ```typescript
 * const { success, waitedMs } = await seekAndWaitForReady(
 *   playerRef.current,
 *   segment.start,
 *   {
 *     maxWaitMs: 3000,
 *     onProgress: (ms) => console.log(`Waiting: ${ms}ms`)
 *   }
 * );
 *
 * if (success) {
 *   player.playVideo();
 * }
 * ```
 */
export async function seekAndWaitForReady(
  player: any,
  targetTime: number,
  options: SeekOptions = {}
): Promise<SeekResult> {
  const {
    maxWaitMs = 3000,
    pollIntervalMs = 50,
    onProgress
  } = options;

  // Validate player instance
  if (!player?.seekTo || typeof player.getPlayerState !== 'function') {
    throw new Error('Invalid YouTube player instance');
  }

  // Initiate seek
  player.seekTo(targetTime, true);

  const startTime = performance.now();
  let elapsedMs = 0;

  return new Promise((resolve) => {
    const checkReady = () => {
      elapsedMs = performance.now() - startTime;

      // Timeout - proceed anyway to avoid hanging
      if (elapsedMs >= maxWaitMs) {
        console.warn(`[seekAndWaitForReady] Timeout after ${elapsedMs}ms`);
        resolve({ success: false, waitedMs: elapsedMs });
        return;
      }

      const state = player.getPlayerState();
      onProgress?.(elapsedMs);

      // YouTube Player States:
      // UNSTARTED(-1), ENDED(0), PLAYING(1), PAUSED(2), BUFFERING(3), CUED(5)

      // Ready states: PAUSED, CUED, or already PLAYING
      if (state === YouTubePlayerStateEnum.PAUSED ||
          state === YouTubePlayerStateEnum.CUED ||
          state === YouTubePlayerStateEnum.PLAYING) {
        resolve({ success: true, waitedMs: elapsedMs });
      } else if (state === YouTubePlayerStateEnum.BUFFERING) {
        // Still buffering, check again
        setTimeout(checkReady, pollIntervalMs);
      } else {
        // Unexpected state, wait a bit and retry
        setTimeout(checkReady, pollIntervalMs);
      }
    };

    // Start checking after small initial delay (allows frame flush)
    setTimeout(checkReady, 16);
  });
}

// ============================================================================
// DYNAMIC SEGMENT END BUFFER (Issue 3)
// ============================================================================

export interface DynamicBufferConfig {
  minBufferSec: number;
  maxBufferSec: number;
  bufferRatio: number;
  adjustForPlaybackRate: boolean;
}

/**
 * Calculates adaptive buffer duration for segment end detection.
 *
 * Replaces fixed 0.3s buffer with dynamic calculation based on:
 * - Segment duration (short segments = smaller buffer)
 * - Playback rate (faster playback = smaller buffer needed)
 * - Min/max bounds for safety
 *
 * @param segmentDuration - Duration of the segment in seconds
 * @param playbackRate - Current playback speed (0.25x - 2x)
 * @param config - Optional configuration overrides
 * @returns Buffer duration in seconds
 *
 * @example
 * ```typescript
 * // 10 second segment at normal speed
 * const buffer = calculateSegmentEndBuffer(10, 1.0);
 * // Returns: 0.5s (10 * 0.05 = 0.5)
 *
 * // 1 second segment at normal speed
 * const buffer = calculateSegmentEndBuffer(1, 1.0);
 * // Returns: 0.1s (clamped to minimum)
 *
 * // 10 second segment at 2x speed
 * const buffer = calculateSegmentEndBuffer(10, 2.0);
 * // Returns: 0.25s (adjusted for playback rate)
 * ```
 */
export function calculateSegmentEndBuffer(
  segmentDuration: number,
  playbackRate: number = 1.0,
  config: Partial<DynamicBufferConfig> = {}
): number {
  const {
    minBufferSec = 0.1,
    maxBufferSec = 0.5,
    bufferRatio = 0.05, // 5% of segment duration
    adjustForPlaybackRate = true
  } = config;

  // Guard against invalid inputs
  if (segmentDuration <= 0) return minBufferSec;
  if (playbackRate <= 0) return maxBufferSec;

  // Base buffer: 5% of segment duration
  let buffer = segmentDuration * bufferRatio;

  // Adjust for playback rate (slower speed = need more buffer in real time)
  if (adjustForPlaybackRate && playbackRate !== 1.0) {
    buffer = buffer / playbackRate;
  }

  // Clamp to reasonable bounds
  return Math.max(minBufferSec, Math.min(maxBufferSec, buffer));
}

// ============================================================================
// SEGMENT BUFFER CACHE (Issue 2)
// ============================================================================

/**
 * LRU cache for tracking which segments are likely buffered by YouTube.
 *
 * Helps avoid redundant buffer preloading by remembering recent seeks.
 * Entries expire after a configurable time (default 30 seconds).
 */
export class SegmentBufferCache {
  private cache = new Map<number, number>(); // segmentIndex → timestamp
  private readonly maxAge: number;

  constructor(options: { maxAge?: number } = {}) {
    this.maxAge = options.maxAge ?? 30000; // 30 seconds default
  }

  /**
   * Mark a segment as buffered (recently seeked to).
   */
  markBuffered(segmentIndex: number): void {
    this.cache.set(segmentIndex, Date.now());
  }

  /**
   * Check if a segment is likely still buffered.
   * Returns false if entry expired or doesn't exist.
   */
  isLikelyBuffered(segmentIndex: number): boolean {
    const timestamp = this.cache.get(segmentIndex);
    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    return age < this.maxAge;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries (garbage collection).
   */
  cleanup(): void {
    const now = Date.now();
    for (const [index, timestamp] of this.cache.entries()) {
      if (now - timestamp >= this.maxAge) {
        this.cache.delete(index);
      }
    }
  }

  /**
   * Get cache statistics for debugging.
   */
  getStats(): { size: number; oldestAge: number; newestAge: number } {
    if (this.cache.size === 0) {
      return { size: 0, oldestAge: 0, newestAge: 0 };
    }

    const now = Date.now();
    const timestamps = Array.from(this.cache.values());
    const ages = timestamps.map(t => now - t);

    return {
      size: this.cache.size,
      oldestAge: Math.max(...ages),
      newestAge: Math.min(...ages)
    };
  }
}
