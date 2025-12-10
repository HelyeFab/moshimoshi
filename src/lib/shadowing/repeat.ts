/**
 * Repeat State Machine for YouTube Shadowing
 *
 * Pure functions for managing segment repetition state.
 * Ported from shadowingPlayer with identical behavior.
 *
 * Key behaviors:
 * - Repeats same segment until count reached
 * - Advances to next segment when quota met
 * - Handles mid-segment repeat count changes
 * - Stays on last segment when no more segments
 */

export interface RepeatState {
  repeatCount: number;      // Target repeats (1-10)
  currentRepeat: number;    // Current repeat number (1-indexed)
  segmentIndex: number;     // Current segment index
  totalSegments: number;    // Total segments in transcript
}

export interface AdvanceResult {
  segmentIndex: number;
  currentRepeat: number;
  didAdvanceSegment: boolean;
}

/**
 * Determines next state when a segment finishes playing.
 *
 * Logic:
 * - If currentRepeat < repeatCount: stay on segment, increment repeat
 * - If currentRepeat >= repeatCount: advance to next segment, reset repeat to 1
 * - If on last segment: stay on it (no wrap-around)
 */
export function nextOnSegmentEnd(state: RepeatState): AdvanceResult {
  if (state.currentRepeat < state.repeatCount) {
    return {
      segmentIndex: state.segmentIndex,
      currentRepeat: state.currentRepeat + 1,
      didAdvanceSegment: false,
    };
  }

  const nextIndex =
    state.segmentIndex + 1 < state.totalSegments
      ? state.segmentIndex + 1
      : state.segmentIndex;

  return {
    segmentIndex: nextIndex,
    currentRepeat: 1,
    didAdvanceSegment: nextIndex !== state.segmentIndex,
  };
}

/**
 * Handles mid-segment repeat count changes.
 *
 * Logic:
 * - If currentRepeat >= newRepeatCount: user lowered threshold below current
 *   progress, so advance to next segment immediately
 * - Otherwise: stay on current segment (more repeats to go, or count increased)
 */
export function onRepeatCountChange(
  state: RepeatState,
  newRepeatCount: number,
): AdvanceResult {
  if (state.currentRepeat >= newRepeatCount) {
    const nextIndex =
      state.segmentIndex + 1 < state.totalSegments
        ? state.segmentIndex + 1
        : state.segmentIndex;

    return {
      segmentIndex: nextIndex,
      currentRepeat: 1,
      didAdvanceSegment: nextIndex !== state.segmentIndex,
    };
  }

  return {
    segmentIndex: state.segmentIndex,
    currentRepeat: state.currentRepeat,
    didAdvanceSegment: false,
  };
}

/**
 * Clamps repeat count to valid range (1-10).
 */
export function clampRepeatCount(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(10, Math.max(1, Math.floor(value)));
}
